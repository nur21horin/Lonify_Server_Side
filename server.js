// server.js
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
dotenv.config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

//const { MongoClient, ServerApiVersion, Admin } = require("mongodb");
const { connect } = require("mongoose");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

//Firebase
const admin = require("firebase-admin");

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;

const PORT = process.env.PORT || 5000;

const app = express();

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.post("/jwt", async (req, res) => {
  const user = req.body;
  const token = jwt.sign(user, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "none",
  });

  res.send({ success: true });
});

const verifyJWT = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).send({ message: "Unauthorized" });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).send({ message: "Forbidden" });
    req.decoded_email = decoded.email;
    next();
  });
};

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

app.post("/create-payment-intent", verifyJWT, async (req, res) => {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: 10, // $10
    currency: "usd",
    payment_method_types: ["card"],
  });

  res.send({ clientSecret: paymentIntent.client_secret });
});

app.patch("/loan-applications/:id/pay", verifyJWT, async (req, res) => {
  const result = await loanAppCollection.updateOne(
    { _id: new ObjectId(req.params.id) },
    {
      $set: {
        applicationFeeStatus: "paid",
        transactionId: req.body.transactionId,
        paidAt: new Date(),
      },
    }
  );
  res.send(result);
});

//Verify Firebase Token (User Authentication)
const verifyFBToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decodedUser = await admin.auth().verifyIdToken(token);
    req.decoded_email = decodedUser.email;
    next();
  } catch (error) {
    return res.status(401).send({ message: "Invalid token" });
  }
};

const verifyAdmin = async (req, res, next) => {
  const user = await userCollection.findOne({ email: req.decoded_email });
  if (!user || user.role !== "admin")
    return res.status(403).send({ message: "Forbidden" });
  next();
};
const verifyManager = async (req, res, next) => {
  const user = await userCollection.findOne({ email: req.decoded_email });
  if (!user || user.role !== "manager")
    return res.status(403).send({ message: "Forbidden" });
  next();
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
function generateLoanId() {
  const prefix = "LOAN";
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}-${random}`;
}
function generateApplicationId() {
  return "APP-" + crypto.randomBytes(4).toString("hex").toUpperCase();
}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db("lonlink_db");
    const userCollection = db.collection("users");
    const loanCollection = db.collection("loans");
    const loanAppCollection = db.collection("loanApplications");

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
    const verifyManager = async (req, res, next) => {
      const email = req.decoded_email;
      const user = await userCollection.findOne({ email });
      if (!user || user.role !== "manager") {
        return res
          .status(403)
          .send({ message: "Forbidden: Manager access required" });
      }
      next();
    };

    app.get("/public/loans", async (req, res) => {
      try {
        const loans = await loanCollection
          .find({ showOnHome: true })
          .limit(6)
          .sort({ createdAt: -1 })
          .toArray();
        res.send(loans);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch public loans" });
      }
    });
    app.get("/loans", verifyFBToken, async (req, res) => {
      const loans = await loanCollection
        .find()
        .sort({ createdAt: -1 })
        .toArray();
      res.send(loans);
    });
    app.get("/loans/:id", verifyFBToken, async (req, res) => {
      try {
        const loan = await loanCollection.findOne({
          _id: new ObjectId(req.params.id),
        });
        if (!loan) return res.status(404).send({ message: "Loan not found" });
        res.send(loan);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch loan details" });
      }
    });

    app.post("/loans", verifyFBToken, verifyManager, async (req, res) => {
      const loan = req.body;
      loan.loanId = generateLoanId();
      loan.createdAt = new Date();
      loan.createdBy = req.decoded_email;
      loan.status = "active";
      const result = await loanCollection.insertOne(loan);
      res.send(result);
    });

    app.get(
      "/manager/loans",
      verifyFBToken,
      verifyManager,
      async (req, res) => {
        try {
          const loans = await loanCollection
            .find({ createdBy: req.decoded_email })
            .sort({ createdAt: -1 })
            .toArray();
          res.send(loans);
        } catch (error) {
          res.status(500).send({ message: "Failed to fetch manager's loans" });
        }
      }
    );
    app.patch("/loans/:id", verifyFBToken, verifyManager, async (req, res) => {
      const result = await loanCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: req.body }
      );
      res.send(result);
    });

    app.patch(
      "/loan-applications/:id/approve",
      verifyFBToken,
      verifyManager,
      async (req, res) => {
        const id = req.params.id;

        const updatedDoc = {
          $set: {
            status: "approved",
            approvedAt: new Date(),
          },
        };
        const result = await loanAppCollection.updateOne(
          { _id: new ObjectId(id) },
          updatedDoc
        );
        res.send(result);
      }
    );

    app.patch(
      "/loan-applications/:id/reject",
      verifyFBToken,
      verifyManager,
      async (req, res) => {
        const id = req.params.id;

        const updatedDoc = {
          $set: {
            status: "rejected",
            rejectedAt: new Date(),
          },
        };
        const result = await loanAppCollection.updateOne(
          { _id: new ObjectId(id) },
          updatedDoc
        );
        res.send(result);
      }
    );
    app.put(
      "/users/:uid/status",
      verifyFBToken,
      verifyAdmin,
      async (req, res) => {
        const { role, isSuspended } = req.body;
        const uid = req.params.uid;

        const user = await userCollection.findOne({ uid });
        if (!user) return res.status(404).send({ message: "User not found" });

        const updateData = {};
        if (role) updateData.role = role;
        if (isSuspended !== undefined) updateData.isSuspended = isSuspended;

        await userCollection.updateOne({ uid }, { $set: updateData });
        const updatedUser = await userCollection.findOne({ uid });

        res.send({ user: updatedUser });
      }
    );

    //users related APi
    app.get("/users", verifyFBToken, verifyAdmin, async (req, res) => {
      const page = Number(req.query.page) || 1;
      const limit = 6;
      const skip = (page - 1) * limit;

      const users = await userCollection
        .find()
        .skip(skip)
        .limit(limit)
        .toArray();

      const total = await userCollection.countDocuments();

      res.send({ users, total });
    });

    app.post("/users", async (req, res) => {
      const user = req.body;

      user.role = user.role || "user";
      user.createdAt = new Date();

      const exist = await userCollection.findOne({ email: user.email });
      if (exist) {
        return res.send({
          message: "User already exists",
          insertedId: exist._id,
          role: exist.role,
        });
      }

      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users/:email/role", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email });
      res.send({ role: user?.role || "user" });
    });
    app.patch(
      "/users/:email/role",
      verifyFBToken,
      verifyAdmin,
      async (req, res) => {
        const { role } = req.body;
        const email = req.params.email;

        // Update role
        const result = await userCollection.updateOne(
          { email },
          { $set: { role } }
        );

        // Fetch updated user
        const updatedUser = await userCollection.findOne({ email });

        res.send({ user: updatedUser });
      }
    );

    app.patch(
      "/users/:email/suspend",
      verifyFBToken,
      verifyAdmin,
      async (req, res) => {
        const { reason } = req.body;
        const email = req.params.email;

        const user = await userCollection.findOne({ email });
        if (!user) return res.status(404).send({ message: "User not found" });

        const updatedStatus = !user.isSuspended; // toggle suspension
        await userCollection.updateOne(
          { email },
          { $set: { isSuspended: updatedStatus, suspendReason: reason || "" } }
        );

        const updatedUser = await userCollection.findOne({ email });
        res.send({ user: updatedUser });
      }
    );

    //loans
    app.post("/loans", verifyFBToken, verifyManager, async (req, res) => {
      const loan = req.body;
      loan.loanId = generateLoanId();
      loan.createdAt = new Date();
      loan.createdBy = req.decoded_email;
      loan.status = "active";
      const result = await loanCollection.insertOne(loan);
      res.send(result);
    });

    app.get("/loans", verifyFBToken, async (req, res) => {
      const loans = await loanCollection
        .find()
        .sort({ createdAt: -1 })
        .toArray();
      res.send(loans);
    });

    app.patch("/loans/:id", verifyFBToken, verifyManager, async (req, res) => {
      const result = await loanCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: req.body }
      );
      res.send(result);
    });

    app.delete("/loans/:id", verifyFBToken, async (req, res) => {
      const user = await userCollection.findOne({ email: req.decoded_email });
      if (!user) return res.status(403).send({ message: "Forbidden" });

      const loan = await loanCollection.findOne({
        _id: new ObjectId(req.params.id),
      });
      if (!loan) return res.status(404).send({ message: "Loan not found" });

      if (user.role !== "admin" && loan.createdBy !== req.decoded_email) {
        return res.status(403).send({ message: "Forbidden" });
      }

      const result = await loanCollection.deleteOne({
        _id: new ObjectId(req.params.id),
      });
      res.send({ success: true, deletedCount: result.deletedCount });
    });

    app.patch(
      "/loans/:id/show",
      verifyFBToken,
      verifyAdmin,
      async (req, res) => {
        const { showOnHome } = req.body;
        const result = await loanCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: { showOnHome } }
        );
        res.send(result);
      }
    );

    //Admin:Approve Loan
    app.patch(
      "/loans/:id/approve",
      verifyFBToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;

        const updatedDoc = {
          $set: {
            status: "approved",
            approvedAt: new Date(),
          },
        };
        const result = await loanCollection.updateOne(
          { _id: new ObjectId(id) },
          updatedDoc
        );
        res.send(result);
      }
    );

    //Admin Reject Loan
    app.patch(
      "/loans/:id/reject",
      verifyFBToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;

        const updatedDoc = {
          $set: {
            status: "rejected",
            rejectedAt: new Date(),
          },
        };
        const result = await loanCollection.updateOne(
          { _id: new ObjectId(id) },
          updatedDoc
        );
        res.send(result);
      }
    );
//loan application 2
    app.post("/loan-applications", verifyFBToken, async (req, res) => {
      const appData = req.body;
      appData.applicationId = generateApplicationId();
      appData.userEmail = req.decoded_email;
      appData.status = "pending";
      appData.applicationFeeStatus = "unpaid";
      appData.createdAt = new Date();
      const result = await loanAppCollection.insertOne(appData);
      res.send(result);
    });

    //Applicant loans
    app.get(
      "/loan-applications/my-applications",
      verifyFBToken,
      async (req, res) => {
        // The user's email is guaranteed to be in req.decoded_email
        // because it passed the verifyFBToken middleware.
        const userEmail = req.decoded_email;

        try {
          const userApps = await loanAppCollection
            .find({ userEmail: userEmail })
            .sort({ createdAt: -1 })
            .toArray();
          res.send(userApps);
        } catch (error) {
          console.error("Error fetching user applications:", error);
          res
            .status(500)
            .send({ message: "Failed to fetch user applications." });
        }
      }
    );

    app.get("/loan-applications", verifyFBToken, async (req, res) => {
      let query = {};
      if (req.query.status) query.status = req.query.status;
      const apps = await loanAppCollection
        .find(query)
        .sort({ createdAt: -1 })
        .toArray();
      res.send(apps);
    });
//loan application
    app.patch(
      "/loan-applications/:id/approve",
      verifyFBToken,
      verifyManager,
      async (req, res) => {
        const result = await loanAppCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: { status: "approved", approvedAt: new Date() } }
        );
        res.send(result);
      }
    );

    app.patch(
      "/loan-applications/:id/reject",
      verifyFBToken,
      verifyManager,
      async (req, res) => {
        const result = await loanAppCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: { status: "rejected", rejectedAt: new Date() } }
        );
        res.send(result);
      }
    );

    app.patch(
      "/loan-applications/:id/cancel",
      verifyFBToken,
      async (req, res) => {
        const appData = await loanAppCollection.findOne({
          _id: new ObjectId(req.params.id),
        });
        if (appData.userEmail !== req.decoded_email)
          return res.status(403).send({ message: "Forbidden" });
        if (appData.status !== "pending")
          return res.status(400).send({ message: "Cannot cancel" });
        const result = await loanAppCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: { status: "canceled" } }
        );
        res.send(result);
      }
    );

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

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
