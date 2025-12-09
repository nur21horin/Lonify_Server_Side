// server.js
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion } = require("mongodb");
const { connect } = require("mongoose");
const PORT = process.env.PORT || 5000;
dotenv.config();
const app = express();

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// MongoDB connection
const username = encodeURIComponent(process.env.DB_Name);
const password = encodeURIComponent(process.env.DB_PASSWORD);

//const uri = `mongodb+srv://${username}:${password}@cluster0.gikxdnx.mongodb.net/${dbName}?retryWrites=true&w=majority`;
const uri = `mongodb+srv://${username}:${password}@cluster0.jsgldpm.mongodb.net/?appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
//connectDB();

run().catch(console.dir);
app.get("/", (req, res) => {
  res.send("LoanLink Backend is Running!");
});

// TODO: Import and use your routes
// app.use('/api/auth', require('./routes/auth'));
// app.use('/api/loans', require('./routes/loans'));
// app.use('/api/loan-applications', require('./routes/loanApplications'));


app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
