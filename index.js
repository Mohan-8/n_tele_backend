const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
require("dotenv").config();
const cors = require("cors");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

// Initialize the Telegram bot with your Telegram API token
const token = process.env.TOKEN;
const bot = new TelegramBot(token, { polling: true });
console.log("Telegram Bot is running");

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected successfully"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Define the User model
const UserSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  firstName: { type: String, required: true },
  lastName: { type: String },
  rewards: { type: Number, default: 0 },
  hasClaimed: { type: Boolean, default: false },
  lastClaimedAt: { type: Date },
  lastClaimedDate: { type: Date },
  sthasClaimed: { type: Boolean, default: false },
  streakCount: { type: Number, default: 0 },
  lastLoginAt: { type: Date },
  referredBy: { type: String },
  referralCount: { type: Number, default: 0 },
  refRewardClaimed: {
    type: [Boolean],
    default: [false, false, false, false, false],
  },
  airdropClaimed: {
    type: [Boolean],
    default: [false, false, false, false, false],
  },
  solanaAddress: { type: String },
  solanaClaimed: { type: Boolean, default: false },
});
const User = mongoose.model("User", UserSchema);

// Create an Express app
const app = express();
app.use(express.json());

const corsOptions = {
  origin: "*", // Restrict this in production
  methods: ["GET", "POST"],
  credentials: true,
};

app.use(cors(corsOptions));
// Handle the /start command with or without a referral ID
bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const referrerId = match[1]; // Extract the referrer ID from the referral link
  const { id, first_name: firstName, last_name: lastName = "" } = msg.from;

  let user = await User.findOne({ telegramId: id });

  if (!user) {
    user = new User({ telegramId: id, firstName, lastName });

    if (referrerId) {
      user.referredBy = referrerId; // Store the referrer
      const referrer = await User.findOne({ telegramId: referrerId });
      if (referrer) {
        referrer.referralCount += 1; // Increment the referrer’s count
        const pointsAwarded = calculateReferralPoints(referrer.referralCount); // Calculate points based on referrals
        referrer.rewards += pointsAwarded; // Add points to rewards
        await referrer.save(); // Save the referrer’s new rewards

        // Notify the referrer about their new points
        bot.sendMessage(
          referrerId,
          `You referred ${user.firstName} ${user.lastName} and earned ${pointsAwarded} points!`
        );
      }
    }

    await user.save();
  }

  const inlineKeyboard = {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Launch",
            web_app: {
              url: `https://aelonnextfront.vercel.app/?userId=${user.telegramId}`,
            },
          },
        ],
      ],
    },
  };

  // Send welcome message
  const welcomeMessage = `Welcome, ${user.firstName}! Click the button below to check your stats.`;
  bot.sendMessage(chatId, welcomeMessage, inlineKeyboard);
});

// Generate JWT token for authentication
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "1h" });
};
const authenticateJWT = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (token) {
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) {
        return res.sendStatus(403);
      }
      req.user = user;
      next();
    });
  } else {
    res.sendStatus(401);
  }
};
// Fetch user data based on userId (endpoint for the frontend to retrieve user info)
app.get("/api/user/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findOne({ telegramId: userId });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const now = new Date();
    const claimInterval = 8 * 60 * 60 * 1000; // 1 minute for testing, change to 8 hours (8 * 60 * 60 * 1000) for production
    let timeRemaining = 0;
    let canClaim = false;
    let streakCount = user.streakCount;
    let lastlogin = user.lastLoginAt;
    // If the user has never claimed, they can claim immediately
    if (!user.lastClaimedAt) {
      canClaim = true;
      timeRemaining = claimInterval / 1000; // Convert milliseconds to seconds
    } else {
      const elapsedTime = now - user.lastClaimedAt; // Calculate elapsed time in milliseconds

      if (elapsedTime >= claimInterval) {
        canClaim = true; // User can claim again
      } else {
        timeRemaining = (claimInterval - elapsedTime) / 1000; // Calculate remaining time in seconds
      }
    }

    res.json({
      id: user.telegramId,
      firstName: user.firstName,
      lastName: user.lastName,
      rewards: user.rewards,
      canClaim,
      timeRemaining,
      streakCount,
      lastlogin, // Send remaining time
    });
  } catch (error) {
    console.error("Error fetching user data:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
});

// Claim rewards endpoint
// Claim points endpoint
app.post("/api/user/:userId/claim", async (req, res) => {
  const { userId } = req.params;
  const { points } = req.body;

  try {
    await User.updateOne(
      { telegramId: userId },
      {
        $inc: { rewards: points },
        $set: { hasClaimed: true, lastClaimedAt: new Date() }, // Store current timestamp
      }
    );
    res.status(200).json({ message: "Points claimed successfully." });
  } catch (error) {
    console.error("Error claiming points:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
});
// bot.onText(/\/referral/, async (msg) => {
//   const chatId = msg.chat.id;
//   const userId = msg.from.id;

//   // Generate a referral link with the userId
//   const referralLink = `http://t.me/minx_a_botin?start=${userId}`;

//   bot.sendMessage(chatId, `Share your referral link: ${referralLink}`);
// });
app.get("/api/user/referrals/:userId", async (req, res) => {
  const userId = req.params.userId;

  try {
    const referredUsers = await User.find({ referredBy: userId });

    const referralDetails = referredUsers.map((user) => ({
      firstName: user.firstName,
      lastName: user.lastName,
      rewards: user.rewards,
    }));

    const referredCount = referralDetails.length;

    // Get the referrer user
    const referrer = await User.findOne({ telegramId: userId });

    res.json({
      referredCount,
      referralDetails,
      refRewardClaimed: referrer?.refRewardClaimed || false,
    });
  } catch (error) {
    console.error("Error fetching referred users:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
});

app.post("/api/user/:userId/claimReferralReward", async (req, res) => {
  const userId = req.params.userId; // This is your telegramId
  const { index } = req.body;

  // Validate the index
  if (typeof index !== "number" || index < 0 || index > 4) {
    return res.status(400).json({ message: "Invalid index" });
  }

  try {
    const user = await User.findOne({ telegramId: userId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if the reward for this milestone has already been claimed
    if (user.refRewardClaimed[index]) {
      return res.status(400).json({ message: "Reward already claimed" });
    }

    // Mark the reward as claimed
    user.refRewardClaimed[index] = true;
    const rewardsArray = [250, 1000, 2500, 6000, 21550]; // Updated rewards
    user.rewards += rewardsArray[index];

    await user.save();

    res
      .status(200)
      .json({ message: "Reward claimed successfully", rewards: user.rewards });
  } catch (error) {
    console.error("Error claiming referral reward:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

const getTodayGMT = () => {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
};

// Handle login and streak update
const streakRewards = [
  100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400,
  1500, 1600, 1700, 1800, 1900, 2000, 2100,
];

const handleLogin = async (userId) => {
  const user = await User.findOne({ telegramId: userId });
  if (!user) {
    return { error: "User not found" };
  }

  const todayGMT = getTodayGMT();
  const lastLogin = user.lastLoginAt ? new Date(user.lastLoginAt) : null;

  if (lastLogin) {
    const lastLoginDateGMT = new Date(
      Date.UTC(
        lastLogin.getUTCFullYear(),
        lastLogin.getUTCMonth(),
        lastLogin.getUTCDate()
      )
    );

    if (lastLoginDateGMT < todayGMT) {
      if ((todayGMT - lastLoginDateGMT) / (1000 * 60 * 60 * 24) === 1) {
        user.streakCount += 1;
      } else {
        user.streakCount = 1;
      }
      user.lastLoginAt = todayGMT;
    }
  } else {
    user.streakCount = 1;
    user.lastLoginAt = todayGMT;
  }

  const streakIndex = user.streakCount - 1;
  const pointsEarned =
    streakIndex < streakRewards.length ? streakRewards[streakIndex] : 0;
  user.rewards += pointsEarned;

  await user.save();

  return {
    rewards: user.rewards,
    streakCount: user.streakCount,
    pointsEarned,
  };
};

// Endpoint to handle user login
app.post("/api/user/:userId/login", async (req, res) => {
  const { userId } = req.params;
  try {
    const updatedUser = await handleLogin(userId);
    if (updatedUser.error) {
      return res.status(404).json({ error: updatedUser.error });
    }
    res.json({
      streakCount: updatedUser.streakCount,
      rewards: updatedUser.rewards,
      pointsEarned: updatedUser.pointsEarned,
    });
  } catch (error) {
    console.error("Error handling login:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Endpoint for fetching streak data
app.get("/api/user/:userId/streak", async (req, res) => {
  try {
    const user = await User.findOne({ telegramId: req.params.userId });
    if (user) {
      return res.json({
        streakCount: user.streakCount,
        rewards: user.rewards,
        canClaim: !user.sthasClaimed,
      });
    }
    res.status(404).json({ error: "User not found" });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});
app.post("/api/user/:userId/airdropAction", async (req, res) => {
  const userId = req.params.userId;
  const { action } = req.body;
  const points = {
    buyRaydium: 5000,
    buyTelegram: 5000,
    followTwitter: 2500,
    joinTelegram: 2500,
    visitWebsite: 2500,
  };
  try {
    const user = await User.findOne({ telegramId: userId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if the action is valid
    if (!points[action]) {
      return res.status(400).json({ message: "Invalid action" });
    }

    const actionIndex = Object.keys(points).indexOf(action);

    if (user.airdropClaimed[actionIndex]) {
      return res
        .status(400)
        .json({ message: "You have already claimed this airdrop." });
    }
    user.rewards += points[action];
    user.airdropClaimed[actionIndex] = true;

    await user.save(); // Save changes to the database

    res
      .status(200)
      .json({ message: "Points added successfully", rewards: points[action] });
  } catch (error) {
    console.error("Error processing airdrop action:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});
app.get("/api/user/:userId/airdropStatus", async (req, res) => {
  const userId = req.params.userId;

  try {
    const user = await User.findOne({ telegramId: userId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({
      airdropClaimed: user.airdropClaimed,
      rewards: user.rewards,
    });
  } catch (error) {
    console.error("Error fetching user airdrop status:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});
app.post("/api/user/:userId/submitSolanaAddress", async (req, res) => {
  const { userId } = req.params;
  const { solanaAddress } = req.body;
  if (!solanaAddress) {
    return res.status(400).json({ message: "Solana address is required" });
  }
  try {
    const user = await User.findOne({ telegramId: userId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (user.solanaAddress) {
      return res.status(400).json({ message: "Solana address already set" });
    }
    user.solanaAddress = solanaAddress;
    user.solanaClaimed = true;
    user.rewards += 2000;
    await user.save();
    res.status(200).json({
      message: "Solana address updated successfully",
      rewards: user.rewards,
    });
  } catch (error) {
    console.error("Error updating Solana address:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});
app.get("/api/user/:userId/solanaInfo", async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findOne({ telegramId: userId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      solanaAddress: user.solanaAddress,
      solanaClaimed: user.solanaClaimed,
    });
  } catch (error) {
    console.error("Error fetching Solana info:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

// Start the Express server
const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
