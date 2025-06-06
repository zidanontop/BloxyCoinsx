const asyncHandler = require("express-async-handler");
const { validationResult, body } = require("express-validator");
const Account = require("../../models/account");
const noblox = require("noblox.js");
const InventoryItem = require("../../models/inventoryItem");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const crypto = require("crypto");
const randomWords = require("random-words");
const { JWT_SECRET } = require("../../config");
let userStore = {};
dotenv.config();

// Initialize noblox.js
(async () => {
  try {
    // Initialize without logging in since we're just using public APIs
    await noblox.setCookie("");
    console.log("Noblox.js initialized successfully");
  } catch (error) {
    console.error("Failed to initialize noblox.js:", error);
  }
})();

// Helper function to add delay between API calls
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to fetch Roblox user data with retries
async function fetchRobloxUserData(userId) {
  for (let i = 0; i < 3; i++) {
    try {
      await delay(1000); // Add 1 second delay between attempts
      const userData = await noblox.getPlayerInfo(userId);
      const userThumbnail = await noblox.getPlayerThumbnail(userId, 420, "png", false, "Headshot");
      
      if (!userData || !userThumbnail?.[0]?.imageUrl) {
        throw new Error("Invalid user data received");
      }

      return {
        userData,
        thumbnail: userThumbnail[0].imageUrl
      };
    } catch (error) {
      console.error(`Attempt ${i + 1} failed:`, error);
      if (i === 2) throw error; // Throw on last attempt
    }
  }
}

exports.authenticateToken = asyncHandler(async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token provided"
      });
    }

    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
      if (err) {
        console.error("Error verifying token:", err);
        return res.status(403).json({
          success: false,
          message: "Invalid or expired token"
        });
      }

      try {
        // Verify user exists in database
        const user = await Account.findById(decoded.id);
        if (!user) {
          return res.status(403).json({
            success: false,
            message: "User not found"
          });
        }

        req.user = decoded;
        next();
      } catch (dbError) {
        console.error("Database error during token verification:", dbError);
        return res.status(500).json({
          success: false,
          message: "Internal server error"
        });
      }
    });
  } catch (error) {
    console.error("Token verification error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});

exports.auto_login = asyncHandler(async (req, res) => {
  try {
    const userData = await Account.findOne(
      { _id: req.user.id },
      { ips: 0, _id: 0, __v: 0, password: 0, withdrawalWalletAddresses: 0 }
    );

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.status(200).json({
      success: true,
      data: userData
    });
  } catch (error) {
    console.error("Error in auto_login:", error);
    res.status(500).json({
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

exports.connect_roblox = [
  body("username")
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage("Your username must be between 3 and 20 characters")
    .escape(),
  body("referrer").trim().escape(),
  asyncHandler(async (req, res) => {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      let userId;
      try {
        userId = await noblox.getIdFromUsername(req.body.username);
        if (!userId) {
          return res.status(404).json({ error: "Invalid Username" });
        }
        await delay(1000); // Add delay after username lookup
      } catch (error) {
        console.error("Noblox username lookup error:", error);
        return res.status(404).json({ error: "Invalid Username" });
      }

      const accountData = await Account.findOne({ robloxId: userId });

      if (accountData) {
        // Existing account flow
        if (userStore[userId]?.descriptionSet === true) {
          try {
            const { userData, thumbnail } = await fetchRobloxUserData(userId);

            if (userData.blurb === accountData.description) {
              const randomDescription = generateRandomDescription();
              await Account.updateOne(
                { robloxId: userId },
                {
                  description: randomDescription,
                  $push: { ips: { ip: req.ip } },
                  thumbnail: thumbnail
                }
              );

              const token = jwt.sign({ id: accountData._id }, JWT_SECRET);
              return res.json({ token });
            } else {
              delete userStore[userId];
              return res.status(400).json({ error: "Description does not match" });
            }
          } catch (error) {
            console.error("Noblox API error:", error);
            return res.status(500).json({ error: "Failed to verify Roblox account. Please try again in a few moments." });
          }
        } else {
          const randomDescription = generateRandomDescription();
          await Account.updateOne({ robloxId: userId }, { description: randomDescription });
          userStore[userId] = { descriptionSet: true };
          return res.json({ description: randomDescription });
        }
      } else {
        // New account flow
        try {
          const { userData, thumbnail } = await fetchRobloxUserData(userId);

          const randomDescription = generateRandomDescription();

          // Handle referrer
          if (req.body.referrer) {
            const checkReferrer = await Account.findOne({ robloxId: req.body.referrer });
            if (checkReferrer) {
              await Account.updateOne(
                { username: checkReferrer.username },
                {
                  $push: {
                    'affiliate.referrals': {
                      robloxId: userId,
                      wagered: 0
                    }
                  }
                }
              );
            }
          }

          const account = new Account({
            robloxId: userId,
            username: userData.username,
            displayName: userData.displayName,
            description: randomDescription,
            thumbnail: thumbnail,
            rank: "User",
            level: 0,
            deposited: 0,
            withdrawn: 0,
            wagered: 0,
            diceClientSeed: generateClientSeed(),
            limboClientSeed: generateClientSeed(),
            minesClientSeed: generateClientSeed(),
            ips: [{ ip: req.ip }]
          });

          await account.save();
          userStore[userId] = { descriptionSet: true };
          return res.json({ description: randomDescription });
        } catch (error) {
          console.error("Account creation error:", error);
          return res.status(500).json({ 
            error: "Failed to create account. Please try again in a few moments." 
          });
        }
      }
    } catch (error) {
      console.error("Connect Roblox error:", error);
      return res.status(500).json({ 
        error: "An error occurred. Please try again in a few moments." 
      });
    }
  }),
];

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

function generateRandomDescription() {
  try {
    // Generate an array of 10-14 random words
    const words = randomWords({ min: 10, max: 14, join: ' ' });
    return `losers ${words}`;
  } catch (error) {
    console.error("Error generating random description:", error);
    // Fallback to a simple random string if random-words fails
    return `losers ${crypto.randomBytes(8).toString('hex')}`;
  }
}
