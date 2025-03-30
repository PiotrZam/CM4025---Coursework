const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser'); // Require the body-parser module

const {MongoClient} = require("mongodb");
const mongoUri = "mongodb://127.0.0.1:27017";
const mongoClient = new MongoClient(mongoUri);

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
    try {
        await mongoClient.connect();
        const dbo = mongoClient.db("whisperedWords");

        // Retrieve all stories from the "story" collection
        const stories = await dbo.collection("story").find({}).toArray();

        res.status(200).json(stories); // Send the stories as a JSON response
    } catch (err) {
        console.error("Error fetching stories:", err);
        res.status(500).json({ success: false, error: "Failed to fetch stories" });
    } finally {
        await mongoClient.close();
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
        // Connect the client to the server (optional starting in v4.7)
        await mongoClient.connect();
        // Establish and verify connection
        await mongoClient.db("whisperedWords").command({ ping: 1 });

        var dbo = mongoClient.db("whisperedWords");

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


    } finally {
        // Ensures that the client will close when you finish/error
        await mongoClient.close();
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
    try {
        console.log(req.body);

        var { postId, userId } = req.body;
        let posts;

        try {
            const postsData = fs.readFileSync('./data/posts.json', 'utf8');
            posts = JSON.parse(postsData);
            console.log('READ');
        } catch (error) {
            console.error('Error reading posts.json:', error.message);
        }

        // Find the post by ID
        var post = posts.find(post => post.id === postId);
        console.log(post);

        if (post) {
            // Check if the user has already liked the post
            if
            // Disabling for demo: User can like a post infinite nr of times  
            //(!post.likes.includes(userId)) 
            (true)
            {
                // Add the user ID to the likes array
                post.likes.push(userId);

                // Update the posts array
                fs.writeFile('./data/posts.json', JSON.stringify(posts, null, 2), (err) => {
                    if (err) {
                        console.error('Error adding like to posts.json:', err.message);
                        return res.status(500).json({ success: false, error: 'Error Liking Post' });
                    }
            
                    res.status(200).json({ success: true, message: 'Post liked successfully.' });
                });

               // res.json({ success: true, message: 'Post liked successfully.' });
            } else {
                res.status(400).json({ success: false, message: 'User has already liked the post.' });
            }
        } else {
            res.status(404).json({ success: false, message: 'Post not found.' });
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});

app.post('/addComment', async (req, res) => {
    try {
        console.log(req.body);

        var { postId, userId, date, content } = req.body;
        let posts;

        try {
            const postsData = fs.readFileSync('./data/posts.json', 'utf8');
            posts = JSON.parse(postsData);
            console.log('READ');
        } catch (error) {
            console.error('Error reading posts.json:', error.message);
        }

        // Find the post by ID
        var post = posts.find(post => post.id === postId);
        
        const newComment = {
            id: generateUniqueId(), // Assign a unique comment ID
            postId,
            userId,
            date: new Date().toLocaleDateString(),
            content
        };

        if (post) {

                // Add the user ID to the likes array
                post.comments.push(newComment);

                // Update the posts array
                fs.writeFile('./data/posts.json', JSON.stringify(posts, null, 2), (err) => {
                    if (err) {
                        console.error('Error adding comment to posts.json:', err.message);
                        return res.status(500).json({ success: false, error: 'Error Adding Comment' });
                    }
            
                    res.status(200).json(newComment);
                });

        } else {
            res.status(404).json({ success: false, message: 'Post not found.' });
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});

async function testDatabaseConnection (t, c, a, g = "unknown", p="1")
{
    try {
        // Connect the client to the server (optional starting in v4.7)
        await mongoClient.connect();
        // Establish and verify connection
        await mongoClient.db("whisperedWords").command({ ping: 1 });
        console.log("Connected successfully to server");
        console.log('Start the database stuff');


        var dbo = mongoClient.db("whisperedWords");
        var story = { title: t, content: c, author: a, genre: g, isPublic: p };
        await dbo.collection("story").insertOne(story, function(err, res) {
            if (err) {
                console.log(err); 
                throw err;
            }
            console.log("1 story inserted");
        }); 

        //Write databse Insert/Update/Query code here..
        console.log('End the database stuff');


    } finally {
        // Ensures that the client will close when you finish/error
        await mongoClient.close();
    }
}

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
