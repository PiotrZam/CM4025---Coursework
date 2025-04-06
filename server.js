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

        if((user) && user.readStories.includes(story._id.toString()))
        {
            console.log(`This story is marked as read: ${story._id}`)
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
                console.log(`This story is marked as read: ${st._id}`)
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

app.get('/top-stories', async (req, res) => {
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
