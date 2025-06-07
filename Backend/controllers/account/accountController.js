const asyncHandler = require("express-async-handler");
const { validationResult, body } = require("express-validator");
const Account = require("../../models/account");
const axios = require("axios");
const InventoryItem = require("../../models/inventoryItem");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const crypto = require("crypto");
const randomWords = require("random-words");
const { JWT_SECRET, JWT_CONFIG, API_SECRET, TOKEN_CONFIG, generateToken, hashToken } = require("../../config");
let userStore = {};
dotenv.config();

// Roblox API endpoints
const ROBLOX_API = {
  USERS_ENDPOINT: 'https://users.roblox.com/v1/usernames/users',
  USER_DETAILS_ENDPOINT: 'https://users.roblox.com/v1/users/',
  THUMBNAILS_ENDPOINT: 'https://thumbnails.roblox.com/v1/users/avatar-headshot',
  REQUEST_TIMEOUT: 10000
};

// Initialize noblox.js without login since we're just using public APIs
console.log("Initializing noblox.js for public API access...");

// Helper function to add delay between API calls
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to validate Roblox username and get user info
async function validateRobloxUser(username) {
  try {
    // Get user ID from username
    const userResponse = await axios.post(ROBLOX_API.USERS_ENDPOINT, {
      usernames: [username],
      excludeBannedUsers: false
    }, {
      timeout: ROBLOX_API.REQUEST_TIMEOUT,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!userResponse.data.data.length) {
      throw new Error("Invalid Username");
    }

    const userId = userResponse.data.data[0].id;
    await delay(1000); // Add delay between API calls

    // Get user details
    const [detailsResponse, thumbnailResponse] = await Promise.all([
      axios.get(`${ROBLOX_API.USER_DETAILS_ENDPOINT}${userId}`, {
        timeout: ROBLOX_API.REQUEST_TIMEOUT,
        headers: {
          'Accept': 'application/json'
        }
      }),
      axios.get(`${ROBLOX_API.THUMBNAILS_ENDPOINT}?userIds=${userId}&size=420x420&format=png`, {
        timeout: ROBLOX_API.REQUEST_TIMEOUT,
        headers: {
          'Accept': 'application/json'
        }
      })
    ]);

    return {
      userId,
      userData: {
        username: detailsResponse.data.name,
        displayName: detailsResponse.data.displayName,
        blurb: detailsResponse.data.description
      },
      thumbnail: thumbnailResponse.data.data[0].imageUrl
    };
  } catch (error) {
    console.error("Roblox validation error:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    }
    throw new Error(error.message || "Failed to validate Roblox user");
  }
}

// Helper function to fetch Roblox user data with retries
async function fetchRobloxUserData(userId) {
  for (let i = 0; i < 3; i++) {
    try {
      // Get user info
      const userData = await axios.get(`${ROBLOX_API.USER_DETAILS_ENDPOINT}${userId}`, {
        timeout: ROBLOX_API.REQUEST_TIMEOUT,
        headers: { 'Accept': 'application/json' }
      });
      if (!userData.data) {
        throw new Error("Failed to fetch user data");
      }
      
      await delay(1000); // Add delay before thumbnail request
      
      // Get user thumbnail
      const thumbnailData = await axios.get(`${ROBLOX_API.THUMBNAILS_ENDPOINT}?userIds=${userId}&size=420x420&format=png`, {
        timeout: ROBLOX_API.REQUEST_TIMEOUT,
        headers: { 'Accept': 'application/json' }
      });
      if (!thumbnailData.data.data[0].imageUrl) {
        throw new Error("Failed to fetch user thumbnail");
      }

      return {
        userData: userData.data,
        thumbnail: thumbnailData.data.data[0].imageUrl
      };
    } catch (error) {
      console.error(`Attempt ${i + 1} failed:`, error.message);
      if (i === 2) throw error;
      await delay(2000); // Longer delay between retries
    }
  }
}

// Store active tokens with their expiry (in memory for now, could move to Redis later)
const activeTokens = new Map();

// Clean up expired tokens periodically
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of activeTokens.entries()) {
    if (data.expiresAt < now) {
      activeTokens.delete(token);
    }
  }
}, 60 * 60 * 1000); // Clean up every hour

// Function to create a new auth token
const createAuthToken = (userData) => {
  const token = generateToken(userData._id);
  
  activeTokens.set(token, {
    userId: userData._id,
    robloxId: userData.robloxId,
    username: userData.username,
    expiresAt: Date.now() + TOKEN_CONFIG.expiresIn
  });

  return token;
};

// Middleware to verify JWT token
exports.authenticateToken = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "No token provided"
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await Account.findById(decoded.userId)
      .select('-ips -__v -password -withdrawalWalletAddresses')
      .lean();

    if (!user) {
      return res.status(403).json({
        success: false,
        message: "Invalid token"
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: "Invalid token"
    });
  }
});

// Auto login with token
exports.auto_login = asyncHandler(async (req, res) => {
  try {
    const user = await Account.findById(req.user._id)
      .select('-ips -__v -password -withdrawalWalletAddresses')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error("Auto login error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});

exports.load_inventory = asyncHandler(async (req, res) => {
  try {
    const userItems = await InventoryItem.find({
      owner: req.user.id,
      locked: false,
    })
      .populate("item")
      .sort({ "item.item_value": -1 })
      .exec();

    const totalValue = userItems.reduce(
      (acc, userItem) => acc + Number(userItem.item.item_value),
      0
    );

    const inventoryInfo = {
      totalValue,
      userItems,
    };

    res.send(inventoryInfo);
  } catch (error) {
    console.error("Error loading inventory items:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Connect Roblox account
exports.connect_roblox = asyncHandler(async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({
        success: false,
        message: "Username is required"
      });
    }

    // Check if account already exists
    const existingAccount = await Account.findOne({ username })
      .select('-ips -__v -password -withdrawalWalletAddresses')
      .lean();

    if (existingAccount) {
      const token = generateToken(existingAccount._id);
      return res.status(200).json({
        success: true,
        data: {
          token,
          account: existingAccount
        }
      });
    }

    // Validate and get Roblox user data
    const robloxData = await validateRobloxUser(username);
    
    // Generate a random description for verification
    const description = `BLOXPVP-${crypto.randomBytes(8).toString('hex')}`;

    // Create new account
    const account = await Account.create({
      username: robloxData.userData.username,
      displayName: robloxData.userData.displayName,
      robloxId: robloxData.userId,
      avatar: robloxData.thumbnail,
      description: description,
      balance: 0,
      totalWagered: 0,
      totalDeposited: 0,
      totalWithdrawn: 0,
      lastLogin: new Date()
    });

    const token = generateToken(account._id);

    res.status(200).json({
      success: true,
      data: {
        description,
        token,
        account
      }
    });
  } catch (error) {
    console.error("Connect Roblox error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to connect Roblox account"
    });
  }
});

exports.roblox_auth_check = asyncHandler(async (req, res, next) => {
  const account = await Account.findOne({ _id: req.user.id });
  if (!account.robloxId) {
    return res.status(401).send("You have not connected your Roblox account");
  }
  next();
});

exports.get_profile = [
  body("userId").trim().escape(),
  asyncHandler(async (req, res) => {
    const userData = await Account.findOne({ robloxId: req.body.userId });

    if (!userData) {
      return res.status(404).send("User was not found");
    }

    const nextLevel = Math.ceil(userData.level);
    const nextLevelXP = Math.pow(nextLevel / 0.04, 2);

    const toReturn = {
      totalBets: userData.totalBets,
      gamesWon: userData.gameWins,
      wagered: userData.wagered,
      profit: userData.withdrawn - userData.deposited,
      username: userData.username,
      xp: userData.wagered,
      xpMax: nextLevelXP,
      level: userData.level,
      thumbnail: userData.thumbnail,
      joinDate: userData.joinDate,
    };

    res.status(200).send(toReturn);
  }),
];

function generateServerSeed() {
  return crypto.randomBytes(20).toString("hex");
}

function generateClientSeed() {
  return crypto.randomBytes(20).toString("hex");
}

// Generate a random description
function generateRandomDescription() {
  try {
    const adjectives = ['cool', 'awesome', 'amazing', 'epic', 'fantastic', 'incredible', 'super', 'great', 'brilliant', 'wonderful'];
    const nouns = ['player', 'gamer', 'champion', 'winner', 'master', 'pro', 'expert', 'legend', 'star', 'hero'];
    const verbs = ['playing', 'gaming', 'winning', 'crushing', 'dominating', 'leading', 'achieving', 'succeeding', 'excelling', 'ruling'];
    
    const getRandomWord = (arr) => arr[Math.floor(Math.random() * arr.length)];
    
    const description = `losers ${getRandomWord(adjectives)} ${getRandomWord(nouns)} ${getRandomWord(verbs)} ${Date.now().toString(36)}`;
    return description;
  } catch (error) {
    console.error("Error generating random description:", error);
    return `losers verification ${Date.now().toString(36)}`;
  }
}
