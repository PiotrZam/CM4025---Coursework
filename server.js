const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser'); // Require the body-parser module

const { ObjectId } = require('mongodb');

const { connectToDatabase, mongoClient } = require("./db"); 

const app = express();
const port = 3000;

// Set up static file serving for the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Add the body-parser middleware to handle JSON and form data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Define a route for the login endpoint
app.post('/login', (req, res) => {
    console.log('Login Attempt...');
    const username = req.body.username;
    const password = req.body.password;
    console.log(username);
    console.log(password);

    // Load the login credentials from the JSON file
    fs.readFile('./data/users.json', 'utf8', (err, data) => {
        if (err) {
            console.log('Error...');
            res.status(500).json({ error: 'Server error: Could not read login credentials' });
            return;
        }

        try {
            const credentials = JSON.parse(data);

            const user = credentials.users.find(user => user.username === username && user.password === password);
            if (user) {
                res.status(200).json({ message: 'Login successful' });
            } else {
                res.status(401).json({ error: 'Invalid username or password' });
            }
        } catch (error) {
            res.status(500).json({ error: 'Server error: Could not parse login credentials' });
        }
    });
});

app.get('/getPosts', async (req, res) => {
    const { userId } = req.query;
    try {
        const dbo = await connectToDatabase();

        // Retrieve all stories from the "story" collection
        const stories = await dbo.collection("story").find({}).toArray();

        stories.forEach(st => {
            var numRatings = 0;
            var averageRating = 0;
            var thisUserRating = 0;

            if (st.ratings && st.ratings.length > 0) {
                numRatings = st.ratings.length;
                var totalRating = st.ratings.reduce((acc, rating) => acc + rating.rating, 0);
                averageRating = totalRating / numRatings;

                // Find the rating for the specific userId
                const userRating = st.ratings.find(rating => rating.userId === userId);

                thisUserRating = userRating ? userRating.rating : 0;
            }
            
            st.numRatings = numRatings;
            st.averageRating = averageRating;
            st.thisUserRating = thisUserRating;
        });

        res.status(200).json(stories); // Send the stories as a JSON response
    } catch (err) {
        console.error("Error fetching stories:", err);
        res.status(500).json({ success: false, error: "Failed to fetch stories" });
    }
});


// server.js
// ...

function generateUniqueId() {
    // Generate a unique ID (you can use a more sophisticated method if needed)
    return Math.random().toString(36).substr(2, 9);
}

app.post('/addPost', async (req, res) => {
    const { title, content } = req.body;

    if (!title || !content) {
        return res.status(400).json({ success: false, error: 'Title and content are required' });
    }

    var newStory = {
        author: 'Server Author', // You may modify this to get the actual author from the request
        date: new Date().toLocaleDateString(),
        title: title,
        content: content,
        genre: 'Unknown',
        isPublic: '1',
        likes: [],  // Initialize the likes array
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

    const newComment = {
        userId: userId,
        date: new Date().toISOString(), // Store the current date and time in ISO format
        content: content
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
