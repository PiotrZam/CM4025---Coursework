const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser'); // Require the body-parser module
const multer = require('multer');   // for uploading images
const axios = require('axios'); 
const dotenv = require('dotenv').config();
const bcrypt = require('bcryptjs');

const session = require("express-session");
const MongoStore = require("connect-mongo");

const xss = require('xss');
const he = require('he');
const validator = require('validator');

const { ObjectId } = require('mongodb');
const { connectToDatabase, mongoClient } = require("./db"); 

// Set up storage engine for Multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // Save files in the "uploads" folder
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
    }
});

const upload = multer({ 
    storage: storage, 
    limits: {fileSize: 5 * 1024 * 1024}
});

const RECAPTCHA_API_URL = 'https://www.google.com/recaptcha/api/siteverify'

const app = express();
const port = process.env.PORT;

/////////////////////////////////

// Set up static file serving for the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Add the body-parser middleware to handle JSON and form data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

//Allow static access to uploaded images
app.use('/uploads', express.static('uploads'));

// Set up the session middleware
app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false, // Whether to save the session if it was not modified during the request
        saveUninitialized: false, // Don't create a session for requests that aren't logged in
        cookie: {
            maxAge: 24 * 60 * 60 * 1000, // 1 day expiry for session cookies
            httpOnly: true, // Helps mitigate XSS attacks
            secure: false // Only set cookies over HTTPS if set to true
        },
        store: MongoStore.create({
            client: mongoClient, 
            dbName: process.env.DB_NAME
        })
    })
);

///////////////////////////////////////////////////////////////////////////////////
// Functions below:

function generateUniqueId() {
    // Generate a unique ID (you can use a more sophisticated method if needed)
    return Math.random().toString(36).substr(2, 9);
}

function countWords(str) {
    return str.split(/\s+/).filter(Boolean).length;  // Split by whitespace and filter out empty strings
}

///////////////////////////////////////////////////////////////////////////////////
// Routes below:

// Backend: Express Route for Checking Login Status
app.get("/checkLoggedIn", (req, res) => {
    if (req.session && req.session.user) {
        // If there's a user session, return the logged-in user's username
        res.json({ loggedIn: true, username: req.session.user.username });
    } else {
        // If no user session, the user is not logged in
        res.json({ loggedIn: false });
    }
});

// Backend: Express Route for Logging Out
app.post("/logout", (req, res) => {
    console.log(req)
    console.log(req.session)
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: "Failed to log out" });
        }
        res.json({ success: true });
    });
});

// Sign Up Endpoint
app.post('/signUp', async (req, res) => {
    const { username, password, recaptchaResponse } = req.body;

    console.log(req.body)

    //#region Input validation
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    if (!validator.isLength(username, { min: 3, max: 20 })) {
        return res.status(400).json({ error: 'Username must be between 3 and 20 characters' });
    }

    const usernameRegex = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
    if (!usernameRegex.test(username)) {
        return res.status(400).json({ error: 'Username must begin with a letter, and can only contain letters, numbers, underscores, and hyphens.' });
    }

    if (!validator.isLength(password, { min: 6, max: 20 })) {
        return res.status(400).json({ error: 'Password must be between 6 and 20 characters' });
    }

    //reCAPTCHA human verification
    try {
        // Verify the reCAPTCHA token with Google's API
        const response = await axios.post(RECAPTCHA_API_URL, null, {
            params: {
                secret: process.env.RECAPTCHA_SECRET_KEY,
                response: recaptchaResponse
            }
        });

        // Check if the reCAPTCHA verification was successful
        if (!response.data.success) {
            res.status(400).send('reCAPTCHA verification failed. Please try again.');
        }
    } catch (error) {
        console.error('Error verifying reCAPTCHA:', error);
        res.status(500).send('Error during reCAPTCHA verification');
    }
    //#endregion Input Validation

    var dbo = await connectToDatabase();

    // Check if the username already exists
    const existingUser = await dbo.collection('users').findOne({ username });
    if (existingUser) {
        return res.status(400).json({ error: 'Username is already taken' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save the new user in the database
    const newUser = { username, password: hashedPassword };
    console.log(newUser)

    try {
        await dbo.collection('users').insertOne(newUser);
        req.session.user = { username }; // stay logged in. Set session data.
        res.status(200).json({ message: 'Account created successfully' });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Failed to create account' });
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Connect to the database
        const db = await connectToDatabase();
        const usersCollection = db.collection('users');

        // Find the user by username
        const user = await usersCollection.findOne({ username: username });

        if (!user) {
            return res.status(400).json({ error: 'Invalid username or password' });
        }

        // Compare the hashed password with the entered password
        const isPasswordCorrect = await bcrypt.compare(password, user.password);

        if (!isPasswordCorrect) {
            return res.status(400).json({ error: 'Invalid username or password' });
        }

        // Successful login
        req.session.user = { username }; // Set session user data
        res.status(200).json({ message: 'Login successful' });

    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/getPosts', async (req, res) => {
    const { userId } = req.query;
    try {
        const dbo = await connectToDatabase();

        // Retrieve all stories from the "story" collection
        const stories = await dbo.collection("story").find({}).toArray();

        stories.forEach(st => {
            // Caulculate total number of ratings, average rarting, and retrieve this user's rating for each story
            var numRatings = 0;
            var averageRating = 0;
            var thisUserRating = 0;

            if (st.ratings && st.ratings.length > 0) {
                numRatings = st.ratings.length;
                var totalRating = st.ratings.reduce((acc, rating) => acc + rating.rating, 0);
                averageRating = totalRating / numRatings;

                // Find the rating given by this user
                const userRating = st.ratings.find(rating => rating.userId === userId);

                thisUserRating = userRating ? userRating.rating : 0;
            }
            
            st.numRatings = numRatings;
            st.averageRating = averageRating;
            st.thisUserRating = thisUserRating;

            // Include URL to the story picture
            if (st.imageUrl && st.imageUrl != "") {
                st.imageUrl = `${req.protocol}://${req.get("host")}${st.imageUrl}`;
                console.log(st.imageUrl)
            } else {
                st.imageUrl = "";
            }

            if(st.genre == null || st.genre == undefined)
            {
                st.genre = "Unknown";
            }
        });

        res.status(200).json(stories); // Send the stories as a JSON response
    } catch (err) {
        console.error("Error fetching stories:", err);
        res.status(500).json({ success: false, error: "Failed to fetch stories" });
    }
});


app.post('/addPost', upload.single('image'), async (req, res) => {

    const { title, content, genre, recaptcha_token } = req.body;
    const wordLimit = 500;

    //#region validation: 
    if (!title || !content) {
        return res.status(400).json({ success: false, error: 'Title and content are required' });
    }

    if (!validator.isLength(title, { min: 1, max: 100 }))
        return res.status(400).json({ error: 'Title must be between 1 and 100 characters.' });

    if (!validator.isLength(content, { min: 5, max: 5000 }))
        return res.status(400).json({ error: 'Content must be between 5 and 5000 characters.' });

    let wordCount = countWords(content);
    console.log(`This story has ${wordCount} words`);

    if(wordCount > wordLimit)
        return res.status(400).json({ error: `Content must be under ${wordLimit} words.` });

    // Multer error handling (file size/type validation)
    if (req.fileValidationError) {
        return res.status(400).json({ success: false, error: req.fileValidationError });
    }

    //reCAPTCHA human verification
    try {
        // Verify the reCAPTCHA token with Google's API
        const response = await axios.post(RECAPTCHA_API_URL, null, {
            params: {
                secret: process.env.RECAPTCHA_SECRET_KEY,
                response: recaptcha_token
            }
        });

        // Check if the reCAPTCHA verification was successful
        if (!response.data.success) {
            res.status(400).send('reCAPTCHA verification failed. Please try again.');
        }
    } catch (error) {
        console.error('Error verifying reCAPTCHA:', error);
        res.status(500).send('Error during reCAPTCHA verification');
    }
    //#endregion validation

    // Get image path if an image was uploaded
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    // Sanitize input 
    const sanitizedTitle = xss(title);
    const sanitizedContent = xss(content);


    var newStory = {
        author: 'Server Author', // You may modify this to get the actual author from the request
        date: new Date().toLocaleDateString(),
        title: sanitizedTitle,
        content: sanitizedContent,
        genre: genre,
        imageUrl,
        isPublic: '1',
        ratings: [], 
        comments: []
    };

    try {
        var dbo = await connectToDatabase();

        var result = await dbo.collection("story").insertOne(newStory, function(err, res) {
            if (err) {
                console.log(err); 
                throw err;
            }
        }); 

        if(result.acknowledged)
        {
            console.log(`Inserted a new story with ID of ${result.insertedId} `)
            console.log(newStory)    
        }
        else {
            console.log(`Failed to insert a new story...`);
        }


    } catch (err) {
        console.error("Error adding a story:", err);
        res.status(500).json({ success: false, error: "Failed to add a story" });
    }

    if(result.acknowledged)
    {
        res.status(200).json(newStory);
    }
    else {
        res.status(400).json({ success: false, error: 'Something went wrong. Failed to add a new story' });
    }
});

app.post('/likePost', async (req, res) => {
    console.log(req.body);
    var { postId, userId } = req.body;

    try {
        const dbo = await connectToDatabase();

        // Convert string ID to MongoDB ObjectId
        const story = await dbo.collection("story").findOne({ _id: new ObjectId(postId)});

        console.log(story);

        if (!story) {
            return res.status(404).json({ success: false, error: "Story not found" });
        }

            // Use $addToSet to ensure userId is added only once
        const result = await dbo.collection("story").updateOne(
            { _id: new ObjectId(postId) },
            { $addToSet: { likes: userId } } // Adds userId to likes array if not already present
        );

        if (result.modifiedCount === 0) {
            console.log("User has already liked this story!")
            return res.status(400).json({ success: false, message: "User has already liked the post." });
        }

        console.log(`Added a new like for story with id: ${story._id}`)
        res.status(200).json(story);
    } catch (err) {
        console.error("Error updating likes:", err);
        res.status(500).json({ success: false, error: "Failed to like a story" });
    }
});

app.post('/rateStory', async (req, res) => {
    console.log(req.body);
    var { storyId, userId, rating } = req.body;

    console.log(req.body);

    // Validate input
    if (!userId || !storyId || !rating || rating < 1 || rating > 5) {
        return res.status(400).json({ success: false, error: "Invalid input. Please provide a valid userId, storyId, and rating between 1 and 5." });
    }

    try {
        const dbo = await connectToDatabase();

        // Convert string ID to MongoDB ObjectId
        const story = await dbo.collection("story").findOne({ _id: new ObjectId(storyId)});

        if (!story) {
            return res.status(404).json({ success: false, error: "Story not found" });
        }

        // If the ratings array doesn't exist, initialize it
        if (!story.ratings) {
            story.ratings = [];
        }

        // Check if the user has already rated the story
        const existingRating = story.ratings.find(rating => rating.userId === userId);
        
        if (existingRating) {
            // If user has already rated, update the rating
            await dbo.collection("story").updateOne(
                { _id: new ObjectId(storyId), "ratings.userId": userId },
                { $set: { "ratings.$.rating": rating } }
            );
            return res.status(200).json({ success: true, message: "Rating updated successfully." });
        } else {
            // If the user hasn't rated yet, push the new rating
            await dbo.collection("story").updateOne(
                { _id: new ObjectId(storyId) },
                { $push: { ratings: { userId: userId, rating: rating } } }
            );
            console.log(`Added a new rating of ${rating} for story with id: ${story._id}`)
            res.status(200).json(story);
        }
    } catch (err) {
        console.error("Error adding a rating:", err);
        res.status(500).json({ success: false, error: "Failed to add a rating" });
    }
});

app.post('/addComment', async (req, res) => {
    console.log(req.body);
    var { postId, userId, date, content } = req.body;

    if (!validator.isLength(content, { min: 1, max: 250 }))
        return res.status(400).json({ error: 'Content must be between 1 and 250 characters.' });

    const sanitizedContent = xss(content);

    const newComment = {
        userId: userId,
        date: new Date().toISOString(), // Store the current date and time in ISO format
        content: sanitizedContent
    };

    try {
        const dbo = await connectToDatabase();

        // Convert string ID to MongoDB ObjectId
        const story = await dbo.collection("story").findOne({ _id: new ObjectId(postId)});

        console.log(story);

        if (!story) {
            return res.status(404).json({ success: false, error: "Story not found" });
        }

            // Use $addToSet to ensure userId is added only once
        const result = await dbo.collection("story").updateOne(
            { _id: new ObjectId(postId) },
            { $push: { comments: newComment } }
        );

        console.log(`Added a new comment for story with id: ${story._id}`)
        res.status(200).json(story);
    } catch (err) {
        console.error("Error adding comment:", err);
        res.status(500).json({ success: false, error: "Failed to add a comment" });
    }
});

// Graceful Shutdown (Close database Connection on Exit)
process.on("SIGINT", async () => {
    await mongoClient.close();
    console.log("MongoDB Connection Closed");
    process.exit(0);
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
