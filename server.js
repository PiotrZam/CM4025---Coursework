const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser'); // Require the body-parser module
const multer = require('multer');   // for uploading images
const axios = require('axios'); 
const dotenv = require('dotenv').config();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

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

// EJS 
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

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

function convertToBool(str) {
    const truthy = [1, "1", true, "true"]
    if(truthy.includes(str))
        return true;
    else
        return false;
}

// This function generates a random alpanumerical code of specified length
function generateCode(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, chars.length);
      code += chars[randomIndex];
    }
    return code;
  }

///////////////////////////////////////////////////////////////////////////////////
// Routes below:

// landing page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

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
        var result = await dbo.collection('users').insertOne(newUser);
        req.session.user = {            // Set session user data
            username: username,
            userID: result.insertedId
        };
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
        req.session.user = {            // Set session user data
            username: user.username,
            userID: user._id
        };
        res.status(200).json({ message: 'Login successful' });

    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


app.get('/getSingleStory', async (req, res) => {
    var storyID = req.query.storyID || ''

    console.log("storyID: " + storyID); 

    if(!storyID)
    {
        res.status(400).json({ success: false, error: "Incorrect request. Story ID needs to be specified" });        
    }

    var userId = 0;
    var username = "";
    if (req.session && req.session.user)
    {
        userId = req.session.user.userID;
        username = username = req.session.user.username;
    }

    try {
        const dbo = await connectToDatabase();

        const user = await dbo.collection("users").findOne({ _id: new ObjectId(userId) });
        const story = await dbo.collection("story").findOne({ _id: new ObjectId(storyID) });

        if(!story)
        {
            res.status(404).json({ success: false, error: "Story could not be found." });
        }

        if(!user && !story.isPublic)
        {
            res.status(404).json({ success: false, error: "Story could not be retrieved. It is private and available only to logged-in users." });
        }

        // Caulculate total number of ratings, average rarting, and retrieve this user's rating for each story
        var numRatings = 0;
        var averageRating = 0;
        var thisUserRating = 0;

        if (story.ratings && story.ratings.length > 0) {
            numRatings = story.ratings.length;
            var totalRating = story.ratings.reduce((acc, rating) => acc + rating.rating, 0);
            averageRating = totalRating / numRatings;

            if(userId)
            {   // Find the rating given by this user
                const userRating = story.ratings.find(rating => rating.userId === userId);
                thisUserRating = userRating ? userRating.rating : 0;
            }
        }
        
        story.numRatings = numRatings;
        story.averageRating = averageRating;
        story.thisUserRating = thisUserRating;
        story.loggedUserName = (user ? user.username : "")

        // Include URL to the story picture
        if (story.imageUrl && story.imageUrl != "") {
            story.imageUrl = `${req.protocol}://${req.get("host")}${st.imageUrl}`;
        } else {
            story.imageUrl = "";
        }

        if(story.genre == null || story.genre == undefined)
        {
            story.genre = "Unknown";
        }

        if((userId) && userId === story.authorID)
        {
            story.isOwnStory = true;
        }

        if((user) && (user.readStories) && user.readStories.includes(story._id.toString()))
        {
            story.isRead = true;
        } 

        res.render('story', { story });
    } catch (err) {
        console.error("Error fetching story:", err);
        res.status(500).json({ success: false, error: "Failed to fetch story" });
    }
});

app.get('/getPosts', async (req, res) => {
    var readfilter = req.query.readfilter || 'all';
    var genre = req.query.genre || '';

    console.log("readfilter: " + readfilter)
    console.log("genre: " + genre)

    var userId = 0;
    var username = "";
    if (req.session && req.session.user)
    {
        userId = req.session.user.userID;
        username = username = req.session.user.username;
    }

    // If user isn't signed in, he cannot use the readfilter
    if(!userId)
    {
        readfilter = 'all'
    }

    try {
        const dbo = await connectToDatabase();

        const user = await dbo.collection("users").findOne({ _id: new ObjectId(userId) });
        let query = {};

        // If the user is not logged in, fetch only public posts
        if (!userId) {
            query.isPublic = { $in: [true, 1, "1"] };
        }

        // if the user is logged in, consider the story read filter
        else {
            if(!user.readStories)
            {
                user.readStories = []
            }
            const readStories = user.readStories.map(id => new ObjectId(id));

            if(readfilter === 'read')
            {
                query._id = { $in: readStories };
            }

            if(readfilter === 'unread')
            {
                query._id = { $nin: readStories };
            }

            // Additionally, don't return the stories written by the current user
            query.authorID = { $ne: userId };
            console.log("UserID: ", userId);

        }

        //genre filter
        if(genre)
        {
            const genreArray = genre.split(',').map(g => g.trim());
            console.log("Genre Array:")
            console.log(genreArray)

            query.genre = { $in: genreArray }
        }

        const stories = await dbo.collection("story").find(query).toArray();

        // For each story perform checks and find additional data so that it's ready to be displayed on dashboard for this user
        stories.forEach(st => {
            // Caulculate total number of ratings, average rarting, and retrieve this user's rating for each story
            var numRatings = 0;
            var averageRating = 0;
            var thisUserRating = 0;

            if (st.ratings && st.ratings.length > 0) {
                numRatings = st.ratings.length;
                var totalRating = st.ratings.reduce((acc, rating) => acc + rating.rating, 0);
                averageRating = totalRating / numRatings;

                if(userId)
                {   // Find the rating given by this user
                    const userRating = st.ratings.find(rating => rating.userId === userId);
                    thisUserRating = userRating ? userRating.rating : 0;
                }
            }
            
            st.numRatings = numRatings;
            st.averageRating = averageRating;
            st.thisUserRating = thisUserRating;

            // Include URL to the story picture
            if (st.imageUrl && st.imageUrl != "") {
                st.imageUrl = `${req.protocol}://${req.get("host")}${st.imageUrl}`;
            } else {
                st.imageUrl = "";
            }

            if(st.genre == null || st.genre == undefined)
            {
                st.genre = "Unknown";
            }

            if((userId) && userId === st.authorID)
            {
                st.isOwnStory = true;
            }

            if((user) && user.readStories.includes(st._id.toString()))
            {
                st.isRead = true;
            } 
        });

        res.status(200).json(stories); // Send the stories as a JSON response
    } catch (err) {
        console.error("Error fetching stories:", err);
        res.status(500).json({ success: false, error: "Failed to fetch stories" });
    }
});

app.post('/addPost', upload.single('image'), async (req, res) => {

    const { title, content, genre, isPublic, recaptcha_token } = req.body;
    const wordLimit = 500;

    console.log("\nNew Request:")
    console.log(req.body)

    var userId = 0;
    var authorName = "Anonymous";
    var validatedIsPublic = true;

    if (req.session && req.session.user)
    {
        userId = req.session.user.userID;
        authorName = req.session.user.username;
    }

    //#region validation: 
    if (!title || !content) {
        return res.status(400).json({ success: false, error: 'Title and content are required' });
    }

    if (!validator.isLength(title, { min: 1, max: 100 }))
        return res.status(400).json({ error: 'Title must be between 1 and 100 characters.' });

    if (!validator.isLength(content, { min: 5, max: 5000 }))
        return res.status(400).json({ error: 'Content must be between 5 and 5000 characters.' });

    let wordCount = countWords(content);

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

    console.log(`isPublic:`)
    console.log(isPublic)
    // validate isPublic
    if(!userId)
    {
        validatedIsPublic = true;
    } else {
        validatedIsPublic = validator.toBoolean(isPublic, 0)
    }

    console.log(`validated isPublic:`)
    console.log(validatedIsPublic)

    //#endregion validation

    // Get image path if an image was uploaded
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    // Sanitize input 
    const sanitizedTitle = xss(title);
    const sanitizedContent = xss(content);

    var newStory = {
        authorID: userId,
        author: authorName, // You may modify this to get the actual author from the request
        date: new Date().toLocaleDateString(),
        title: sanitizedTitle,
        content: sanitizedContent,
        genre: genre,
        imageUrl,
        isPublic: validatedIsPublic,
        ratings: [], 
        comments: []
    };

    if(!userId)
    {
        // Generate code that the user can use to claim the story in the future
        const claimStoryCode = generateCode(12);
        newStory.claimCode = claimStoryCode;            
    }
    

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
            console.log("Added a story!")
            
            if(userId)
            {
                newStory.isOwnStory = true;
            } else {
                newStory.isOwnStory = false;
            }

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

app.delete('/deleteStory/:id', async (req, res) => {
    const storyId = req.params.id;

    var userId = 0;

    if (req.session && req.session.user)
    {
        userId = req.session.user.userID;
    }

    if(!userId)
    {
        return res.status(404).send('User not recognised');
    }

    try {
        const dbo = await connectToDatabase();
        
        // First check if user is the author
        const story = await dbo.collection("story").findOne({ _id: new ObjectId(storyId) });

        if (!story) {
            return res.status(404).send('Story not found');
        }

        if (story.authorID !== userId) {
            return res.status(403).send('You are not the author of this story');
        }

        // verification completed, proceed to deleting the story
        const result = await dbo.collection("story").deleteOne({ _id: new ObjectId(storyId) });

        if (result.deletedCount === 1) {
            res.status(200).send('Story deleted successfully');
        } else {
            res.status(404).send('Story not found');
        }
    } catch (err) {
        console.error('Error deleting story:', err);
        res.status(500).send('Error deleting story');
    }
});


app.post('/rateStory', async (req, res) => {
    var { storyId, rating } = req.body;
    var userId = 0;
    if (req.session && req.session.user)
    {
        userId = req.session.user.userID;
    }

    if(!userId)
    {
        return res.status(400).json({ success: false, error: "Only logged in users can rate stories. Please log in first." });
    }

    // Validate input
    if (!storyId || !rating || rating < 1 || rating > 5) {
        return res.status(400).json({ success: false, error: "Invalid input. Please provide a valid storyId, and rating between 1 and 5." });
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
    var { postId, content } = req.body;
    var userId = 0;
    var username = "";

    console.log("Session:")
    console.log(req.session)

    if (req.session && req.session.user)
    {
        userId = req.session.user.userID;
        username = req.session.user.username;
    }

    console.log("Adding a comment...")
    console.log(`UserID: ${userId}, username: ${username}`)

    if(!userId)
    {
        return res.status(400).json({ success: false, error: "Only logged in users can add comments. Please log in first." });
    }

    if (!validator.isLength(content, { min: 1, max: 250 }))
        return res.status(400).json({ error: 'Content must be between 1 and 250 characters.' });

    const sanitizedContent = xss(content);

    const newComment = {
        userId: userId,
        author: username,
        date: new Date().toISOString(), // Store the current date and time in ISO format
        content: sanitizedContent
    };

    try {
        const dbo = await connectToDatabase();

        // get the story
        const story = await dbo.collection("story").findOne({ _id: new ObjectId(postId)});

        console.log(story);

        if (!story) {
            return res.status(404).json({ success: false, error: "Story not found" });
        }

        const result = await dbo.collection("story").updateOne(
            { _id: new ObjectId(postId) },
            { $push: { comments: newComment } }
        );

        if(result.acknowledged)
        {
            console.log(`Added a new comment for story with id: ${story._id}`)
            res.status(200).json(newComment);
        } else {
            throw new Error("Something went wrong. Failed to add a comment!");
        }

    } catch (err) {
        console.error("Error adding comment:", err);
        res.status(500).json({ success: false, error: "Failed to add a comment" });
    }
});

app.post('/updateReadStatus', async (req, res) => {
    const { storyId, isRead } = req.body;  // Get data from the request body
    var isReadBool = validator.toBoolean(isRead, 0)

    console.log(`StoryID: ${storyId}`)

    var userId = 0;
    if (req.session && req.session.user)
    {
        userId = req.session.user.userID;
    }

    if(!storyId)
    {
        return res.status(400).json({ success: false, error: "story not found" }); 
    }

    if(!userId)
    {
        return res.status(400).json({ success: false, error: "Only logged in users can mark stories as read. Please log in first." });
    }

    try {
        const dbo = await connectToDatabase();

        // Find the user in the "users" collection
        const user = await dbo.collection("users").findOne({ _id: new ObjectId(userId) });

        if (!user) {
            return res.status(404).send('User not found');
        }

        const story = await dbo.collection("story").findOne({ _id: new ObjectId(storyId) });

        if (!story) {
            return res.status(404).send('Story not found');
        }

        if (!user.readStories) {
            await dbo.collection("users").updateOne(
                { _id: new ObjectId(userId) },
                { $set: { readStories: [] } }
            );

            user.readStories = [];
        }

        console.log("Set story as read:")
        console.log(typeof isReadBool)
        console.log(isReadBool)

        // Update the "read stories" array
        if (isReadBool) {
            // Add the storyId to the list of read stories
            if (!user.readStories.includes(storyId)) {
                await dbo.collection("users").updateOne(
                    { _id: new ObjectId(userId) },
                    { $push: { readStories: storyId } }
                );
                console.log("story marked as read")
                res.status(200).send({ message: 'Story marked as read' });
            } else {
                res.status(200).send({ message: 'Story already marked as read' });
            }
        } else {
            // Remove the storyId from the user's list of read stories
            await dbo.collection("users").updateOne(
                { _id: new ObjectId(userId) },
                { $pull: { readStories: storyId } }
            );
            res.status(200).send({ message: 'Story marked as unread' });
        }
    } catch (err) {
        console.error('Error updating read status:', err);
        res.status(500).send('Error updating read status');
    }
});

app.get('/topStories', async (req, res) => {
    console.log("Requested top stories data...")
    const nrStories = 10;
    try {
        const dbo = await connectToDatabase();
        const topStories = await dbo.collection('story').aggregate([
            {
                $project: {
                    _id: 1,
                    title: 1,
                    author: 1,
                    date: 1,
                    genre: 1,
                    isPublic: 1,
                    ratings: { $ifNull: ["$ratings", []] }, // Ensure ratings is always an array
                    averageRating: { $avg: { $ifNull: ["$ratings.rating", 0] } }, // Handle missing rating values
                    numRatings: { $size: { $ifNull: ["$ratings", []] } } // Ensure numRatings is based on an array
                }
            },
            {
                $sort: { averageRating: -1, numRatings: -1, date: -1 } // Sort by highest average rating
            },
            {
                $limit: 10 // Get top 10 stories
            }
        ]).toArray();

        res.json(topStories);
    } catch (error) {
        console.error("Error fetching top stories:", error);
        res.status(500).json({ error: "Failed to fetch top stories" });
    }
});

app.get('/currentUsersStories', async (req, res) => {
    console.log("Requested current user's stories...")

    var userId = 0;
    if (req.session && req.session.user)
    {
        userId = req.session.user.userID;
    }

    if(!userId)
    {
        return res.status(400).json({ success: false, error: "User not logged in" });
    }

    try {
        const dbo = await connectToDatabase();

        const user = await dbo.collection("users").findOne({ _id: new ObjectId(userId) });

        if (!user) {
            return res.status(404).send('User not found');
        }

        console.log("useID: ", user._id)

        const userStories = await dbo.collection('story').aggregate([
            {
                $match: { authorID: userId } // Filter stories by author ID
            },
            {
                $project: {
                    _id: 1,
                    title: 1,
                    author: 1,
                    date: 1,
                    genre: 1,
                    averageRating: { $avg: { $ifNull: ["$ratings.rating", 0] } }, // Handle missing rating values
                    numRatings: { $size: { $ifNull: ["$ratings", []] } } // Ensure numRatings is based on an array
                }
            },
            {
                $sort: { date: -1 } // Sort by highest average rating
            }
        ]).toArray();

        // Records that don't have ratings returned nulls as avg rating. We need to take care of this:
        userStories.forEach(story => {
            story.averageRating = story.averageRating ?? 0;
        });

        const numStories = userStories.length;
        const numStoriesWithRatings = userStories.filter(story => story.numRatings > 0).length;
        const ratingsReceived = userStories.reduce((sum, story) => sum + story.numRatings, 0);

        // Average story rating
        const totalAverageRating = userStories.reduce((sum, story) => sum + story.averageRating, 0);
        const avgStoryRating = numStories > 0 ? totalAverageRating / numStoriesWithRatings : 0; // consider only stories that have rating

        // Now get the number of read stories
        if(!user.readStories)
        {
            user.readStories = [];
        }
        const numStoriesRead = user.readStories.length;

        //And the number of ratings given:
        const ratingsGiven = await dbo.collection('story').aggregate([
            {
              $unwind: "$ratings"  
            },
            {
              $match: { "ratings.userId": userId } 
            },
            {
              $count: "totalRatingsGiven"  
            }
        ]).toArray();

        const totalRatingsGiven = ratingsGiven.length > 0 ? ratingsGiven[0].totalRatingsGiven : 0;
        console.log("Ratings Given: ", totalRatingsGiven)
          

        var output = {
            numStories: numStories,
            avgStoryRating: avgStoryRating,
            numStoriesRead: numStoriesRead,
            ratingsReceived: ratingsReceived,
            ratingsGiven: totalRatingsGiven,
            stories: userStories
        }

        console.log(output);

        res.json(output);
    } catch (error) {
        console.error("Error fetching user rating:", error);
        res.status(500).json({ error: "Failed to fetch user rating" });
    }
});

app.get('/topAuthors', async (req, res) => {
    console.log("Requested top ranked users...")

    const numAuthors = 10;

    try {
        const dbo = await connectToDatabase();

        var topUsers = await dbo.collection('story').aggregate([
            // consider only stories that have an author
            {
                $match: {
                  authorID: { $exists: true, $ne: 0 }
                }
            },
            // Calculate average rating and number of ratings for each story
            {
              $addFields: {
                avgStoryRating: { $avg: { $ifNull: ["$ratings.rating", 0] } },
                numRatings: { $size: { $ifNull: ["$ratings", []] } }
              }
            },
            // Group by authorID 
            {
              $group: {
                _id: "$authorID",
                avgAuthorRating: { $avg: "$avgStoryRating" },
                totalRatings: { $sum: "$numRatings" },
                totalStories: { $sum: 1 }
              }
            },
            // Sort by avg rating desc, then by total number of ratings desc
            {
              $sort: { avgAuthorRating: -1, totalRatings: -1 }
            },
            {
              $limit: numAuthors
            }
        ]).toArray();

        const authorIDs = topUsers.map(author => new ObjectId(author._id));

        // Get usernames for these users
        const users = await dbo.collection('users')
        .find({ _id: { $in: authorIDs } })
        .project({ _id: 1, username: 1 })
        .toArray();

        console.log("users")
        console.log(users)

        topUsers.forEach((au) => {
            var user = users.find(u => u._id.toString() === au._id.toString());

            if(user)
                au.username = user.username;
        });

        // Assign users ranks (records are already ordered based on popularity, we just need to add these indexes to the array)
        topUsers = topUsers.map((user, index) => ({
            ...user,
            rank: index + 1 
        }));

        console.log(topUsers)

        // Get only the users that have username
        topUsers = topUsers.filter(u => (u.username) );

          console.log("top users:")
          console.log(topUsers)

        res.json(topUsers);
    } catch (error) {
        console.error("Error fetching top user ratings:", error);
        res.status(500).json({ error: "Failed to fetch top user ratings" });
    }
});

app.get('/topReaders', async (req, res) => {
    console.log("Requested top ranked readers...")

    const numReaders = 10;

    try {
        const dbo = await connectToDatabase();

        // Get the top readers (people who rated stories the most)
        var topReaders = await dbo.collection('story').aggregate([
            // Unwind the ratings array to deal with each rating individually
            { $unwind: "$ratings" },
            //Filter out ratings where userID is 0
            {
              $match: {
                "ratings.userId": { $ne: 0 }
              }
            },
            // Group by ratings.userID and count how many ratings each user has made
            {
              $group: {
                _id: "$ratings.userId",
                totalRatingsGiven: { $sum: 1 },
              }
            },
            { $sort: { totalRatingsGiven: -1 } },
            { $limit: numReaders }
        ]).toArray();
          

        // Testing - filter out fake IDs
        topReaders = topReaders.filter(r => r._id.toString().length > 6)

        console.log("Top Readers: ")
        console.log(topReaders)

        var readersIDs = topReaders.map(reader => new ObjectId(reader._id));
        
        // At the moment comments array stores userID as string, rather than ObjectID -- needs addressing!
        var readersIDsString = topReaders.map(reader => reader._id.toString());

        // Get comment count left by these readers works similarly as the query above
        const readersComments = await dbo.collection('story').aggregate([
            { $unwind: "$comments" },
            {
              $match: {
                "comments.userId": { $in: readersIDsString }
              }
            },
            {
              $group: {
                _id: "$comments.userId",   
                totalComments: { $sum: 1 } 
              }
            },
            { $sort: { totalComments: -1 } },
            { $limit: numReaders }
          ]).toArray();

        // Get usernames for these users
        const readers = await dbo.collection('users')
        .find({ _id: { $in: readersIDs } })
        .project({ _id: 1, username: 1 })
        .toArray();

        // Add usernames and comment counts
        topReaders.forEach((r) => {
            var user = readers.find(u => u._id.toString() === r._id.toString());

            if(user)
                r.username = user.username;

            var comments = readersComments.find(c => c._id.toString() === r._id.toString())
            r.commentsCount = (comments) ? comments.totalComments : 0;
        });

        // Get only the users that have username
        topReaders = topReaders.filter(u => (u.username) );

        // Sprt using first total ratings given, then total comments
        var sortedReaders = topReaders.sort((a, b) => {
            return b.totalRatingsGiven - a.totalRatingsGiven || b.totalComments - a.totalComments;
        });

        // Assign users ranks (now that we have our array sorted)
        sortedReaders = sortedReaders.map((reader, index) => ({
            ...reader,
            rank: index + 1 
        }));

        console.log("Top Readers: ")
        console.log(sortedReaders)

        res.json(sortedReaders);
    } catch (error) {
        console.error("Error fetching top readers ratings:", error);
        res.status(500).json({ error: "Failed to fetch top readers ratings" });
    }
});

app.post('/claimStory', async (req, res) => {
    var { storyId, userInput } = req.body;

    var claimCode = userInput;
    var userId = 0;
    var username = "";

    console.log("Claiming a story...")
    console.log("User input: ", claimCode)
    console.log("Story ID: ", storyId)

    if (req.session && req.session.user)
    {
        userId = req.session.user.userID;
        username = req.session.user.username;
    }

    // Validation
    if(!userId)
    {
        return res.status(400).json({ success: false, error: "Only logged in users can claim stories. Please log in first." });
    }

    if(!claimCode)
    {
        return res.status(400).json({ success: false, error: "The claim code wasn't sent. Please try again." });
    }

    try {
        const dbo = await connectToDatabase();

        // get the user
        const user = await dbo.collection("users").findOne({ _id: new ObjectId(userId)});
        if(!user)
        {
            return res.status(400).json({ success: false, error: "User not found" });
        }

        // get the story
        const story = await dbo.collection("story").findOne({ _id: new ObjectId(storyId)});

        console.log(story);

        if (!story) {
            return res.status(404).json({ success: false, error: "Story not found" });
        }

        if (!story.claimCode || story.authorID) {
            return res.status(403).json({ success: false, error: "This story cannot be claimed" });
        }

        console.log("Actual Claim Code: ", story.claimCode)
        console.log("Sent Claim Code: ", claimCode)

        const areClaimCodesSame = (claimCode === story.claimCode)
        console.log("Claim Codes same? : ", areClaimCodesSame)

        if(!areClaimCodesSame)
        {
            return res.status(401).json({ success: false, error: "Provided Claim Code is incorrect." });
        }

        const result = await dbo.collection("story").updateOne(
            { _id: new ObjectId(storyId) },
            { $set: { 
                    authorID: user._id.toString(),
                    author: user.username
                },
                $unset: { claimCode: "" } 
            }
        );

        if (!result.acknowledged) {
            return res.status(500).json({ success: false, error: "Database operation failed" });
          }

        if (result.modifiedCount === 0) {
            // Failed to update the story
            return res.status(400).json({ success: false, error: "Story could not be claimed." });
        }

        console.log(`Successfully claimed the following story: ${story._id}`)
        res.status(200).json({ success: true, message: "Story claimed successfully!\nYou can now see it on your profile page." });

    } catch (err) {
        console.error("Error claiming story:", err);
        res.status(500).json({ success: false, error: "Failed to claim a story" });
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
