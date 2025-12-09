// server.js
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion, Admin } = require("mongodb");
const { connect } = require("mongoose");
const PORT = process.env.PORT || 5000;
dotenv.config();
const app = express();

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

//Verify Firebase Token (User Authentication)
const verifyFBToken=async(req,res,next)=>{
  const token=req.headers.authorization;

  if(!token) return res.status(401).send({message:"unauthorized access"});

  try{
    const idToken=token.split(" ")[1];
    const decoded=await Admin.auth().verifyIdToken(idToken);
    req.decoded_email=decoded.email;
    next();
  }catch(err){
    return res.status(401).send({message:'unauthorized access'});
  }
};


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

//Genarate Loan Tracing ID
function generateLoanId(){
  const prefix="LOAN";
  const random=crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}-${random}`;
}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db("lonlink_db");
    const userCollection = db.collection("users");
    const loanCollection = db.collection("loans");

    
    //verifyAdmin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded_email;
      const query = { email };
      const user = await userCollection.findOne(query);

      if (!user || user.role !== "admin") {
        return res.status(403).send({ message: "" });
      }
      next();
    };

    //users related APi
    app.get("/users",verifyFBToken, async (req, res) => {
      const searchText = req.query.searchText;
      const query = {};
      if (searchText) {
        query.$or = [
          { displayName: { $regex: searchText, $options: "i" } },
          { email: { $regex: searchText, $options: "i" } },
        ];
      }

      const cursor = userCollection
        .find(query)
        .sort({ createdAt: -1 })
        .limit(6);
      const result = await cursor.toArray();
      res.send(result);
    });

    
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
