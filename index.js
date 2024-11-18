const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
app.use(express.json());

const PORT = process.env.PORT;
// user.model.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  firstName: { type: String, required: true },
  lastName: { type: String },
  hasClaimed: { type: Boolean, default: false },
  rewards: { type: Number, default: 0 },
  farmingStartTime: { type: Date, default: null },
  isFarming: { type: Boolean, default: false },
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
<<<<<<< HEAD
    default: [false, false, false, false, false, false, false, false],
=======
    default: [false, false, false, false, false,false],
>>>>>>> 0da82593d3b228359e6201711a826b35acee84e0
  },
  solanaAddress: { type: String },
  solanaClaimed: { type: Boolean, default: false },
});

app.use(express.json());

const corsOptions = {
  origin: "*",
  methods: ["GET", "POST"],
  credentials: true,
};

app.use(cors(corsOptions));
// Initialize the bot
const TelegramBot = require("node-telegram-bot-api");
const token = process.env.TOKEN;
const bot = new TelegramBot(token, { polling: true });
console.log("Telegram Bot is running");

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected successfully"))
  .catch((err) => console.error("MongoDB connection error:", err));
<<<<<<< HEAD

const User = mongoose.model("User", userSchema);
app.get("/", (req, res) => {
  res.send(
    "WORKING!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
  );
});
=======
const User = mongoose.model("User", userSchema);
>>>>>>> 0da82593d3b228359e6201711a826b35acee84e0
// Telegram bot /start command with referral handling
bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const referrerId = match[1];
  const { id, first_name: firstName, last_name: lastName = "" } = msg.from;

  let user = await User.findOne({ telegramId: id });

  if (!user) {
    user = new User({ telegramId: id, firstName, lastName });

    if (referrerId) {
      user.referredBy = referrerId;
      const referrer = await User.findOne({ telegramId: referrerId });
      if (referrer) {
        referrer.referralCount += 1;
        await referrer.save();
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

  const welcomeMessage = `Welcome, ${user.firstName}! Click the button below to Launch the Game.`;
  bot.sendMessage(chatId, welcomeMessage, inlineKeyboard);
});

app.get("/api/user/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findOne({ telegramId: userId });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    let canClaim = false;
    let streakCount = user.streakCount;
    let lastlogin = user.lastLoginAt;

    res.json({
      id: user.telegramId,
      firstName: user.firstName,
      lastName: user.lastName,
      rewards: user.rewards,
      canClaim,
      streakCount,
      lastlogin,
    });
  } catch (error) {
    console.error("Error fetching user data:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
});
app.post("/api/user/:userId/start-farming", async (req, res) => {
  const { userId } = req.params;
  let user = await User.findOne({ telegramId: userId });

  if (user && user.isFarming) {
    return res.status(400).json({ message: "Farming already in progress." });
  }

  // Start farming
  if (!user) {
    user = new User({ telegramId: userId });
  }

  user.isFarming = true;
  user.hasClaimed = false;
  user.farmingStartTime = new Date();
  await user.save();

  res.json({
    message: "Farming started!",
    farmingStartTime: user.farmingStartTime,
  });
});

// Claim tokens endpoint
app.post("/api/user/:userId/claim-tokens", async (req, res) => {
  const { userId } = req.params;
  const user = await User.findOne({ telegramId: userId });

  //   if (!user || (!user.isFarming && !user.hasClaimed)) {
  //     return res.status(400).json({ message: "No farming session active." });
  //   }

  const timeElapsed = (new Date() - user.farmingStartTime) / 1000; // in seconds

  if (timeElapsed < 8 * 3600) {
    return res.status(400).json({ message: "Farming session not completed." });
  }

  // Add 28,800 tokens
  user.rewards += 840;
  user.isFarming = false;
  user.hasClaimed = true;
  user.farmingStartTime = null;
  await user.save();

  res.json({ message: "Tokens claimed!", tokens: user.tokens });
});

// Get status endpoint
app.get("/api/user/:userId/get-status", async (req, res) => {
  const { userId } = req.params;
  const user = await User.findOne({ telegramId: userId });

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const timeElapsed = user.isFarming
    ? Math.floor((new Date() - user.farmingStartTime) / 1000)
    : 0;
  if (timeElapsed >= 8 * 3600) {
    // If 8 hours have elapsed, set isFarming to false and cap tokens at 28800
    user.isFarming = false;
    user.timeElapsed = 8 * 3600; // cap at 8 hours
    await user.save();
  }

  res.json({
    tokens: user.rewards,
    farming: user.isFarming,
    timeElapsed,
  });
});

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
  const userId = req.params.userId;
  const { index } = req.body;

  if (typeof index !== "number" || index < 0 || index > 4) {
    return res.status(400).json({ message: "Invalid index" });
  }

  try {
    const user = await User.findOne({ telegramId: userId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.refRewardClaimed[index]) {
      return res.status(400).json({ message: "Reward already claimed" });
    }

    user.refRewardClaimed[index] = true;
    const rewardsArray = [250, 1000, 2500, 6000, 21550];
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
<<<<<<< HEAD
    LikeTwitter: 2000,
    joinBirds: 50,
    joinTon: 50,
=======
    LikeTwitter:2000,
>>>>>>> 0da82593d3b228359e6201711a826b35acee84e0
  };
  try {
    const user = await User.findOne({ telegramId: userId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

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

    await user.save();

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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
