require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const path = require('path');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const jwt = require("jsonwebtoken");

const app = express();
const port = process.env.PORT || 4000;

// Check for required environment variables
if (!process.env.MONGODB_URI || !process.env.JWT_SECRET) {
    console.error("Error: Required environment variables are not defined.");
    process.exit(1);
}

// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("Connected to MongoDB Atlas"))
    .catch((err) => console.error("Error connecting to MongoDB:", err));

// Define Mongoose Schemas
const journalSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    title: String,
    entry: String,
    score: Number,
    mood: String,
    date: { type: Date, default: Date.now }
});
const Journal = mongoose.model('Journal', journalSchema);

const userSchema = new mongoose.Schema({
    username: String,
    email: String,
    password: String,
});
const User = mongoose.model('User', userSchema);

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Handle Signup
app.post('/signup', async (req, res) => {
    const hashedPassword = await bcrypt.hash(req.body.psw, 10);
    const newUser = new User({
        username: req.body.username,
        email: req.body.email,
        password: hashedPassword
    });

    try {
        await newUser.save();
        console.log('User saved successfully:', newUser);
        res.redirect('/login2.html');
    } catch (err) {
        console.error('Error saving user:', err);
        res.status(500).send('Error saving user.');
    }
});

// Handle Login
app.post('/login', async (req, res) => {
    const { uname, psw } = req.body;

    try {
        const user = await User.findOne({ email: uname });
        if (user && await bcrypt.compare(psw, user.password)) {
            console.log('User logged in successfully:', user);
            const token = jwt.sign({ userId: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: "1h" });
            res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
            res.redirect('/entry2.html');
        } else {
            console.log('Invalid email or password.');
            res.status(401).send('Invalid email or password.');
        }
    } catch (err) {
        console.error('Error logging in:', err);
        res.status(500).send('Error logging in.');
    }
});

// Middleware to Authenticate Token
function authenticateToken(req, res, next) {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).send('Access denied. No token provided.');
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        console.error('Invalid token:', err);
        res.status(403).send('Invalid token.');
    }
}

// Serve Protected Entry Page
app.get('/entry2.html', authenticateToken, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'entry2.html'));
});

// Fetch Journal Entries
// app.get('/get-entries', authenticateToken, async (req, res) => {
//     const userId = req.user.userId;

//     try {
//         const entries = await Journal.find({ userId }).sort({ date: -1 });
//         res.json(entries);
//     } catch (err) {
//         console.error('Error fetching journal entries:', err);
//         res.status(500).send('Error fetching journal entries.');
//     }
// });
app.get('/get-entries', authenticateToken, async (req, res) => {
    const userId = req.user.userId; // Get user ID from the token

    try {
        const entries = await Journal.find({ userId: userId }).sort({ date: -1 }); // Fetch entries sorted by date
        res.json(entries);
    } catch (err) {
        console.error('Error fetching journal entries:', err);
        res.status(500).send('Error fetching journal entries.');
    }
});


// Submit Journal Entry
// app.post('/submit-entry', authenticateToken, async (req, res) => {
//     const { title, entry, score, mood } = req.body;
//     const userId = req.user.userId;

//     if (!title || !entry || !score || !mood) {
//         return res.status(400).json({ message: 'All fields are required.' });
//     }

//     try {
//         const newEntry = new Journal({ userId, title, entry, score, mood });
//         await newEntry.save();
//         console.log('Journal entry saved successfully:', newEntry);
//         res.status(201).json({ message: 'Journal entry saved successfully.' });
//     } catch (err) {
//         console.error('Error saving journal entry:', err);
//         res.status(500).send('Error saving journal entry.');
//     }
// });
app.post('/submit-entry', authenticateToken, async (req, res) => {
    const { title, entry, score, mood } = req.body;

    if (!title || !entry || !score || !mood) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    try {
        const newEntry = new Journal({
            userId: req.user.userId, // Assuming token authentication
            title,
            entry,
            score,
            mood,
            date: new Date(),
        });

        await newEntry.save();
        console.log('Journal entry saved:', newEntry);

        res.redirect('/journal.html'); // Redirect to the journal page after submission
    } catch (err) {
        console.error('Error saving journal entry:', err);
        res.status(500).json({ message: 'Error saving journal entry.' });
    }
});

// app.post('/submit-mood', authenticateToken, async (req, res) => {
//     const { mood, score } = req.body;

//     if (!mood || score === undefined) {
//         return res.status(400).json({ message: 'Mood and score are required.' });
//     }

//     try {
//         // Save mood and score to the database
//         const newEntry = new Journal({
//             userId: req.user.userId, // Authenticated user ID
//             mood,
//             score,
//             date: new Date(), // Automatically add the current date
//         });

//         await newEntry.save(); // Save the new entry to MongoDB

//         console.log('Mood and score saved successfully:', newEntry);

//         // Redirect to journal.html after saving
//         res.redirect('/journal.html');
//     } catch (err) {
//         console.error('Error saving mood and score:', err);
//         res.status(500).json({ message: 'Error saving mood and score.' });
//     }
// });


// Logout
app.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/login2.html');
});

// Start the Server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
