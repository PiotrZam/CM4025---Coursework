// main.js
const userId = '2345';
const addPostButton = $("#add-post-button");
const postForm = $("#post-form");
const dashboard = $(".dashboard");
const postsWrapper = $("#posts-wrapper");

$(document).ready(function () {
    
     // Fetch posts when the page is loaded or refreshed
     fetchPosts();

     // Populate list of genres
     populateGenres();

    // Attach event delegation to the parent container
    $(postsWrapper).on("click", ".fa-star", function () {
        console.log("Clicked to rate!!!");
        rateStory(this);
    });


    addPostButton.on("click", function () {
        // Blur the background
        postsWrapper.addClass("blur");

        // Show the post form
        postForm.show();
    });

    postForm.on("submit", function (event) {
        event.preventDefault();
    
        // Create FormData object
        let formData = new FormData();

        // Get reCAPTCHA token
        var recaptchaToken = grecaptcha.getResponse();

        // If the reCAPTCHA token is empty, it means the user hasn't completed the reCAPTCHA challenge
        if (!recaptchaToken) {
            alert("Please complete the reCAPTCHA.");
            return;
        }
    
        // Get values from the form
        formData.append("title", $("#post-title").val());
        formData.append("content", $("#post-content").val());
        formData.append("genre", $("#post-genre").val());
    
        // Get the selected image file
        const imageFile = $("#post-image")[0].files[0];
        if (imageFile) {
            formData.append("image", imageFile);
        }

        // Append the reCAPTCHA token to the form data
        formData.append("recaptcha_token", recaptchaToken);
    
        // Send AJAX request using FormData
        $.ajax({
            url: "/addPost",
            type: "POST",
            data: formData,
            processData: false,  // Prevent jQuery from processing data
            contentType: false,  // Let the browser set Content-Type for FormData
            success: function (post) {
                // Create new post element (ensure backend sends back the image URL)
                const newPost = createPostElement(
                    post._id, 
                    post.author,
                    post.genre,
                    post.date, 
                    post.title, 
                    post.content, 
                    0, // numRatings 
                    0, // averageRating
                    0, // comments
                    post.imageUrl // Add image URL to display it
                );
    
                postsWrapper.prepend(newPost);
    
                // Reset the form and hide it
                postForm.trigger("reset").hide();
                postsWrapper.removeClass("blur");
            },
            error: function () {
                alert("Error adding post. Please try again.");
            }
        });
    });
    

    $("#cancel-button").on("click", function () {
        // Reset the form and hide it
        postForm.trigger("reset").hide();

        // Remove the blur effect from the background
        postsWrapper.removeClass("blur");
    });

});
// End of document.ready

function fetchPosts() {
    var data = {
        userId: userId
    };

    // Fetch posts from the server using jQuery AJAX
    $.ajax({
        url: `/getPosts?userId=${userId}`,
        type: "GET",
        dataType: "json",
        success: function (posts) {
            // Clear existing posts from the the wrapper
            postsWrapper.empty();

            // Add each post to the the wrapper
            posts.forEach(function (post) {
                var newPost = createPostElement(
                    _id = post._id, 
                    author =  post.author, 
                    genre = post.genre,
                    date = post.date, 
                    title = post.title, 
                    content =  post.content, 
                    numRatings =  post.numRatings, 
                    averageRating = post.averageRating, 
                    comments = post.comments,
                    imageUrl = post.imageUrl
                );
                console.log(post.thisUserRating);

                //Highlight stars if ratings was given
                const starsElement = newPost.find('.stars').first();
                if(post.thisUserRating > 0)
                    {
                        //convert jquery element to html element
                        starsHtml = starsElement.get(0);
                        // Make sure stars are highlighter in line with user's rating
                        highlightStars(starsHtml, post.thisUserRating);
                    }

                if(post.comments != null && post.comments.length > 0)
                {
                    displayComments(newPost, post.comments);
                }
                postsWrapper.append(newPost);
            });
        },
        error: function () {
            console.error("Error fetching posts from the server.");
        }
    });
}

function createPostElement(_id, author, genre, date, title, content, numRatings, averageRating, comments, imageUrl) {
    let commentsCount = comments ? comments.length : 0;
    let numRatingsHTML = `<p class="num-rating">Ratings No: ${numRatings}</p>`;

    const postElement = $("<div>").addClass("post");

    postElement.html(`
        <input type="hidden" class="post-id" value="${_id}">
        <div class="post-header">
            <span class="author">${he.escape(author)}</span>
            <span class="genre">${he.escape(genre)}</span>
            <span class="date">${date}</span>
        </div>

        <h2 class="title">${he.escape(title)}</h2>

        ${imageUrl ? `<img src="${imageUrl}" alt="Story Image" class="post-image">` : ''}
        <p class="contents">${he.escape(content)}</p>

        <div class="reactions-container">
            <div class="rating-container">
                <p>Rate this story:</p>
                <div class="stars">
                    <i class="far fa-star" data-value="1"></i>
                    <i class="far fa-star" data-value="2"></i>
                    <i class="far fa-star" data-value="3"></i>
                    <i class="far fa-star" data-value="4"></i>
                    <i class="far fa-star" data-value="5"></i>
                </div>
                <p class="average-rating">Average Rating: ${(numRatings > 0) ? averageRating.toFixed(1) : 'No ratings yet'}</p>
                ${(numRatings > 0) ? numRatingsHTML : ''}
            </div>
            <div class="comment-container">
                <button class="comment-button" onclick="toggleComments(this)">
                    <i class="far fa-comment"></i> Comment
                </button>
                <div class="commentsCount">
                    <p class="commentsCountText">${commentsCount}</p>
                </div>
            </div>
        </div>

        <div class="add-comment-form" style="display: none;">
            <textarea class="comment-textarea" placeholder="Add a comment"></textarea>
            <button class="add-comment-button" onclick="addComment(this)">Post</button>
        </div>

        <div class="comments-section"></div>
    `);

    return postElement;
}

function likePost(buttonElement) {
    var postElement = buttonElement.closest('.post');
    var postId = postElement.querySelector('.post-id').value;
    var likesCount = postElement.querySelector('.likesCountText');
    console.log(postElement);
    console.log('Like nr: ' + $(likesCount).text());
    console.log('Post liked: ' + postId);

   // if (postId == null) {
        // Create the data to be sent in the request body
        var data = {
                    postId: postId,
                    userId: userId
                };

        // Perform the server request using jQuery
        $.ajax({
            url: '/likePost',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(data),
            success: function (response) {
                    // Handle the success response from the server
                    console.log('Server response:', response);
                    let theCount = parseInt($(likesCount).text()) + 1 
                    $(likesCount).text(theCount); // Assuming the server returns the updated like count
        
            },
            error: function (error) {
                    // Handle the error response from the server
                    console.error('There was a problem with the AJAX request:', error);
            }
        });
//    } else {
  //          console.error('Error: Post element not found.');
    //}
}

function toggleComments(buttonElement) {
    const postElement = $(buttonElement).closest('.post');
    const commentsWrapper = $(postElement).find('.comments-wrapper');
    const addCommentForm = $(postElement).find('.add-comment-form');
    const commentContent = $(postElement).find('.comment-textarea');
    
    console.log("Post element: " + postElement);
    console.log("Comment content: " + commentContent.val());

    // Clear the text area
    $(commentContent).val("");

    commentsWrapper.slideToggle();
    addCommentForm.slideToggle();
}

function addComment(buttonElement) {
    const postElement = $(buttonElement).closest('.post'); 
    const commentsWrapper = $(postElement).find('.comments-section');
    const commentTextarea = $(postElement).find('.comment-textarea');
    const postId = $(postElement).find('.post-id').val();
    const addCommentForm = $(postElement).find('.add-comment-form');
    const commentContent = commentTextarea.val();
    var commentsCount = $(postElement).find('.commentsCountText');

    const commentData = {
        userId: userId,
        postId: postId,
        content: commentContent
    };

    addCommentForm.slideToggle();
    console.log(commentData)

    $.ajax({
        url: '/addComment',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(commentData),
        success: function (response) {
            // Handle the success response from the server
            console.log('Comment added successfully');

            //Add the comment
            let comment = generateCommentHTML(response);
            commentsWrapper.prepend(comment);

            // increment comment count
            let theCount = parseInt($(commentsCount).text()) + 1 
            $(commentsCount).text(theCount);
            //Clear the text area:
            $(commentContent).val("");
        },
        error: function (error) {
            // Handle the error response from the server
            console.error('Error adding comment:', error);
        }
    });
}


function getCurrentDate() {
    const currentDate = new Date();
    const options = { month: "long", day: "numeric", year: "numeric" };
    return currentDate.toLocaleDateString("en-US", options);
}

function generateCommentHTML(comment) {
    const commentDiv = $('<div>').addClass('comment');
    const commentAuthor = $('<span>').addClass('comment-author').text(comment.userId);
    const commentDate = $('<span>').addClass('comment-date').text(comment.date);
    const commentContent = $('<p>').addClass('comment-content').text(he.decode(comment.content));

    commentDiv.append(commentAuthor, commentDate, commentContent);
    return commentDiv;
}

function displayComments(postElement, comments) {
    const commentsSection = postElement.find('.comments-section');
    commentsSection.empty(); // Clear previous comments to avoid duplication

    comments.forEach(comment => {
        let commentDiv = generateCommentHTML(comment);
        commentsSection.append(commentDiv);
    });
}

function rateStory(starElement) {
    var postElement = starElement.closest('.post');
    var storyId = postElement.querySelector('.post-id').value;
    const rating = parseInt(starElement.dataset.value);

    console.log("Called rateStory!");

    fetch("/rateStory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId, userId, rating })
    })
    .then(response => response.json())
    .then(data => {
        // document.querySelector(".average-rating").innerText = `Average Rating: ${data.averageRating.toFixed(1)}`;
        highlightStars(starElement.parentNode, rating);
    })
    .catch(error => console.error("Error rating story:", error));
}

function highlightStars(container, rating) {
    container.querySelectorAll("i").forEach(star => {
        star.classList.remove("fas");
        star.classList.add("far");
        if (parseInt(star.dataset.value) <= rating) {
            star.classList.add("fas");
        }
    });
}

function populateGenres() {
    const genres = [
        'Fiction',
        'Drama',
        'Mystery',
        'Horror',
        'Romance',
        'Comedy',
        'Fantasy',
        'Sci-Fi',
        'Thriller',
        'Other'
    ];
    

    // Get the genre select element using jQuery
    const genreSelect = $('#post-genre');

    // Clear any existing options before appending new ones
    genreSelect.empty();

    // Populate the select element with genre options using jQuery
    genres.forEach(genre => {
        const option = $('<option></option>').val(genre).text(genre);
        genreSelect.append(option);
    });
}
