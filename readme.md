# BLOXPVP Casino

A modern casino platform for BLOXPVP with features like Coinflip, Jackpot, and Marketplace.

## Deployment on Render

### Prerequisites
1. Create a [Render](https://render.com) account
2. Fork this repository to your GitHub account
3. Set up your environment variables in Render dashboard

### Environment Variables Required
Make sure to set these in your Render dashboard:
```env
NODE_ENV=production
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
# Add other environment variables from .env.example
```

### Deployment Steps
1. Log in to your Render dashboard
2. Click "New +" and select "Web Service"
3. Connect your GitHub repository
4. Render will automatically detect the configuration from `render.yaml`
5. Click "Create Web Service"

The deployment will start automatically. You can monitor the build progress in the Render dashboard.

## Local Development

### Backend Setup
```bash
cd Backend
npm install
cp .env.example .env  # Copy and configure environment variables
npm start
```

### Frontend Setup
```bash
cd Frontend
npm install
npm start
```

## Project Structure
- `/Backend` - Node.js/Express backend server
- `/Frontend` - React frontend application
- `render.yaml` - Render deployment configuration

## API Documentation
The API endpoints are available at:
- Health Check: `GET /api/health`
- Other endpoints...

## Contributing
1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

# BloxPVP Leak - 


This is a guide to getting started with BloxPVP Leak -  Follow these instructions to set up the project locally on your machine.

Figma: https://figma.com/file/Qlff2LjgChKmrT6ZXG02ug/Untitled

# WARNING BLOX PVP IS RIGGED! - Heres proof:
In the join_coinflip function within `/BE/controllers/coinflip/coinflipController.js`, the lines that implement the rigging functionality by overriding the coinflip result based on certain users roblox ids listed in the xxLIDsS array are:

Line 283: `result = joiningCoinflip.ownerCoin == "heads" ? "tails" : "heads";`

Line 285: `result = joiningCoinflip.ownerCoin == "heads" ? "heads" : "tails";`

These lines manipulate the result variable to ensure that the coinflip outcome is the opposite of what it should be. Example if a regular user created a coinflip, the site owner or whoever was in the xxLIDsS array would win since the result of the coinflip would be forced to be opposite of what the user chose. 

**Installation Process (locally)**

**Install Dependencies** Run the following command in your terminal to install the necessary dependencies:

`npm i`

**Backend Setup**

`Navigate to the backend (BE) directory and analyze the config.js file. Ensure you set your environment variables properly. Here's an example of the required variables:`

`PORT=PORT`

`JWT_SECRET=SECRET`

`MONGODB_URI=DB_URI`

`XP_CONSTANT=XP_GAIN`

`TRANSACTION_SECRET=SECRET_TRANSACTIONS_GAME`

`OXAPAY_MERCHANT_API_KEY=MERCHANT_KEY_FOR_OXAPAY`

`PAYOUT_API_KEY=PAYOUT_KEY_FOR_OXAPAY`

Start the backend server by running:

`node app.js`

**Frontend Setup**

Navigate to the frontend (FE) directory.

Run the following command to start the frontend:

For development:
`npm run dev`

For production preview:
`npm run preview`
