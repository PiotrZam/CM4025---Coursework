// Import functions:
//import { checkLoggedIn, setUpLogoutLink } from './allPages.js';

// main.js
const addPostButton = $("#add-post-button");
const postForm = $("#post-form");
const dashboard = $(".dashboard");
const postsWrapper = $("#posts-wrapper");

$(document).ready(async function () {

    await checkLoggedIn();
    setUpLogoutLink();

    var loggedIn = ($('#loggedUserName').val() ? true : false)
    console.log(`Logged in: ${loggedIn}`)

    if(!loggedIn)
    {
        $('#post-public').prop('disabled', true);
    } else {
        $('#post-public').prop('disabled', false);
    }
    
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

        var isPublic = $('#post-public').prop('checked');

        formData.append("isPublic", isPublic);
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
                var postHTML = createPostElement(
                    post._id, 
                    post.author,
                    post.genre,
                    post.date, 
                    post.title, 
                    post.content, 
                    0, // numRatings 
                    0, // averageRating
                    0, // comments
                    post.imageUrl, // Add image URL to display it,
                    post.isPublic,
                    post.isOwnStory
                );
    
                modifyPostAfterCreation(post, postHTML)

                postsWrapper.prepend(postHTML);
    
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


//#region login functions

function checkLoggedIn()
{
    return new Promise((resolve, reject) => {
        // Check if user is logged in
        $.ajax({
            url: "/checkLoggedIn",
            type: "GET",
            success: function(response) {
                if (response.loggedIn) {
                    setUsername(response.username);
                } else {
                    clearUsername();
                }
                resolve(response);
            },
            error: function() {
                clearUsername();
                resolve(false);
            }
        });
    });
}

function setUsername(username)
{
    // User is logged in, display the username
    $('#user-status-text').text(username);
    $('#logout-link').show();  // Show the log out link
    $('#loggedUserName').val(username); // set to hidden input field

    // Remove the click event handler for "Log in" text if user is logged in
    $('#user-status-text').off('click');
}

function clearUsername()
{
    // User is not logged in, display "Log in"
    $('#user-status-text').text('Log in');
    $('#logout-link').hide();
    $('#loggedUserName').val(''); // clear hidden input field

    // Add a click listener to the "Log in" text
    $('#user-status-text').on('click', function() {
        window.location.href = 'login.html';  // Redirect to the login page
    });
}

function setUpLogoutLink() {
    // add event handler to logout link
    $('#logout').click(function (event) {
        event.preventDefault();  // Prevent the default link behavior

        // Send a POST request to the server to log out
        $.ajax({
            url: '/logout',  // POST request to the logout route
            type: 'POST',    // Change type to POST
            success: function () {
                alert("You are now logged out")
                window.location.href = 'login.html'; // Redirect to login page
            },
            error: function () {
                alert('Failed to log out');
            }
        });
    });
}

//#endregion Login functions

function fetchPosts() {

    // Fetch posts from the server using jQuery AJAX
    $.ajax({
        url: `/getPosts`,
        type: "GET",
        dataType: "json",
        success: function (posts) {
            // Clear existing posts from the the wrapper
            postsWrapper.empty();

            // Add each post to the the wrapper
            posts.forEach(function (post) {
                var postHTML = createPostElement(
                    post._id, 
                    post.author, 
                    post.genre,
                    post.date, 
                    post.title, 
                    post.content, 
                    post.numRatings, 
                    post.averageRating,
                    post.comments,
                    post.imageUrl,
                    post.isPublic,
                    post.isOwnStory
                );
                console.log(post.thisUserRating);

                modifyPostAfterCreation(post, postHTML);
                postsWrapper.append(postHTML);
            });
        },
        error: function () {
            console.error("Error fetching posts from the server.");
        }
    });
}

function createPostElement(_id, author, genre, date, title, content, numRatings, averageRating, comments, imageUrl, isPublic, isOwnStory) {
    let commentsCount = comments ? comments.length : 0;
    let numRatingsHTML = `<p class="num-rating">Ratings No: ${numRatings}</p>`;

    const postElement = $("<div>").addClass("post");

    postElement.html(`
        <input type="hidden" class="post-id" value="${_id}">
        <div class="post-header">
            <span class="author">${he.escape(author)}</span>
            <span class="genre">${he.escape(genre)}</span>
            ${isPublic ? '<span class="public-status ps-public">Public</span>' : '<span class="public-status ps-private">Private</span>'}
            ${isOwnStory ? `<span class="delete-story dels-active" onclick="deleteStory('${_id}')">Delete</span>` : '<span class="delete-story"></span>'}
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
                <button class="comment-button" ${($('#loggedUserName').val()) ? 'onclick="toggleAddCommentBox(this)"' : ''}>
                    <i class="far fa-comment"></i> Comment
                </button>
                <div class="commentsCount">
                    <p class="commentsCountText">${commentsCount}</p>
                </div>
                <button class="toggle-comments" onclick="toggleComments(this)">
                    <i class="fas fa-chevron-down"></i>
                </button>
            </div>
        </div>

        <div class="add-comment-form" style="display: none;">
            <textarea class="comment-textarea" placeholder="Add a comment"></textarea>
            <button class="add-comment-button" onclick="addComment(this)">Post</button>
        </div>

        <div class="comments-section" style="display: none;"></div>
    `);

    return postElement;
}

function modifyPostAfterCreation(post, postHTML)
{   
    // Display comments 
    if(post.comments != null && post.comments.length > 0)
    {
            displayComments(postHTML, post.comments);
    }

    // User not logged in...
    if(!$('#loggedUserName').val())
    {
        // Give comments inactive look
        $(postHTML).find('.comment-button').addClass('inactive');
        $(postHTML).find('.comment-button').attr('title', 'Only logged-in users can leave comments');

        // Make stars look inactive
        $(postHTML).find('.fa-star').addClass('inactive');
        $(postHTML).find('.fa-star').attr('title', 'Only logged-in users can give rating');
    } 
    
    // User logged in...
    else {
        //Highlight stars if ratings was given
        const starsElement = postHTML.find('.stars').first();
        if(post.thisUserRating > 0)
        {
            //convert jquery element to html element
            var starsHtml = starsElement.get(0);
            // Make sure stars are highlighter in line with user's rating
            highlightStars(starsHtml, post.thisUserRating);
        }
    }
}

function deleteStory(storyId) {
    $.ajax({
        url: `/deleteStory/${storyId}`,  
        method: 'DELETE',
        success: function(response) {
            // If the post was deleted successfully, remove it from the DOM
            $(`.post .post-id[value='${storyId}']`).closest('.post').remove();
            alert("Post deleted successfully.");
        },
        error: function(err) {
            console.error('Error deleting post:', err);
            alert("There was an error deleting the post.");
        }
    });
}

function toggleAddCommentBox(buttonElement) {
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

function toggleComments(buttonElement) {
    const postElement = $(buttonElement).closest('.post');
    const commentsWrapper = $(postElement).find('.comments-section');
    const icon = $(buttonElement).find('i');

    commentsWrapper.slideToggle(250, function() {
        // This callback is executed after the slideToggle animation completes
        if (commentsWrapper.is(':visible')) {
            icon.removeClass('fa-chevron-down').addClass('fa-chevron-up'); // Change to unfold icon
        } else {
            icon.removeClass('fa-chevron-up').addClass('fa-chevron-down'); // Change to fold icon
        }
    });
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
        postId: postId,
        content: commentContent
    };

    addCommentForm.slideToggle();
    console.log("commentData...")
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
            console.log("Response...")
            console.log(response)

            console.log("New Comment HTML...")
            console.log(comment)

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
    const date = new Date(comment.date)
    const formattedDate = `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    const commentDiv = $('<div>').addClass('comment');
    const commentAuthor = $('<span>').addClass('comment-author').text(comment.author);
    const commentDate = $('<span>').addClass('comment-date').text(formattedDate);
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
        body: JSON.stringify({ storyId, rating })
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
