require("dotenv").config();
const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const mongoose = require("mongoose");
const cors = require("cors");
const session = require('express-session');
const MongoStore = require('connect-mongo');
const { rateLimit } = require("express-rate-limit");
const Account = require("./models/account");
const helmet = require("helmet");
const bodyParser = require("body-parser");
const { body, validationResult } = require("express-validator");
const crypto = require("crypto");
const indexRouter = require("./routes/index");
const { initSocket, getIO } = require("./utils/socket");
const { Webhook } = require("discord-webhook-node");
const { MONGODB_URI } = require("./config");
const http = require("http");
const compression = require("compression");
const utils = require("./utils/events");
const withdrawCryptoHook = new Webhook(
  "https://discord.com/api/webhooks/1225837252706435243/ZVzyp0IAPNI23MHJJ9IhcYbOX71vxrJei0exfIT09grKGVJlGuf-2kNV-DmoDmY1F-vY"
);
withdrawCryptoHook.setUsername("BLOXPVP");
withdrawCryptoHook.setAvatar(
  "https://s3-alpha-sig.figma.com/img/2b34/f172/b5c4249c2ed513c73212e742814f4b54?Expires=1711324800&Key-Pair-Id=APKAQ4GOSFWCVNEHN3O4&Signature=Vpjq2og4gzlTx9nsXfXmBo9FYg3ZkHzKSVKf5gejUHqvUUSJLQpFaYLYowTYFB~gJ32aPnVwnrwP~oqKz2gmcrfjBleISf2gdDhXRdHWAc~mDfU33sf3Y6fKYww1pfkEjC17RAWHV60TUwmjauNfPG1-6jTOjYYwUO-X4nS7Dz1tr9OWjDYe2jAccfV4mApd83RFYASsJbnDNqbd7BCfAbiFR8VKe2jmsSBavksA~cBSWpNb4W4f7Udw7GzRgTTyjSodO3XFDxOiuYbsNHc-cTFa~7AIei7bYzibtLXQM09NXZBKhirk6jUhqb9tHvTiwF37jYYXepZemEmnTyz7qw__"
);

const app = express();

const socketServer = http.createServer(app);
initSocket(socketServer);

mongoose.set("strictQuery", false);

// MongoDB Connection
console.log("Attempting MongoDB connection...");

main().catch((err) => console.log("MongoDB connection error:", err));
async function main() {
  await mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  console.log("MongoDB connected successfully");
}

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'bloxpvp_session_secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: MONGODB_URI,
    ttl: 7 * 24 * 60 * 60, // 7 days
    autoRemove: 'native'
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));

app.set("trust proxy", 1);
app.use(helmet());
app.use(compression());

// CORS configuration with credentials
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://mm-2-betters-x-6ktvg.vercel.app']
    : ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(logger("short"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/", indexRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

socketServer.listen(6565, () => {
  console.log("Server is running on port 6565");
});

function emitEvent(eventName, data) {
  io.emit(eventName, data);
}

module.exports = emitEvent;
module.exports = app;
