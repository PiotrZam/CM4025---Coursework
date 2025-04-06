// Module containing functions used in other js files

//#region Enums

// Genres:
export const genres_enum = [
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

//#endregion Enums

//#region login functions

export function checkLoggedIn()
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

export function setUpLogoutLink() {
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

//#endregion login functions

//#region Post Creation functions

export function getCurrentDate() {
    const currentDate = new Date();
    const options = { month: "long", day: "numeric", year: "numeric" };
    return currentDate.toLocaleDateString("en-US", options);
}

export function createPostElement(post) {
    let commentsCount = post.comments ? post.comments.length : 0;
    let numRatingsHTML = `<p class="num-rating">Ratings No: ${post.numRatings}</p>`;

    const postElement = $("<div>").addClass("post");

    postElement.html(`
        <input type="hidden" class="post-id" value="${post._id}">
        <div class="post-header">
            <span class="author">${he.escape(post.author)}</span>
            <span class="genre">${he.escape(post.genre)}</span>
            ${post.isPublic ? '<span class="public-status ps-public">Public</span>' : '<span class="public-status ps-private">Private</span>'}
            ${post.isOwnStory ? `<span class="delete-story dels-active" onclick="deleteStory('${post._id}')">Delete</span>` : '<span class="delete-story"></span>'}
            <span class="date">${post.date}</span>
        </div>

        <h2 class="title">${he.escape(post.title)}</h2>

        ${post.imageUrl ? `<img src="${post.imageUrl}" alt="Story Image" class="post-image">` : ''}
        <p class="contents">${he.escape(post.content)}</p>

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
                <p class="average-rating">Average Rating: ${(post.numRatings > 0) ? post.averageRating.toFixed(1) : 'No ratings yet'}</p>
                ${(post.numRatings > 0) ? numRatingsHTML : ''}
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
            <div class="seen-story-container">
                <button class="seen-story-btn" ${($('#loggedUserName').val()) ? 'onclick="markAsRead(this)' : ''}">
                    I've read this story
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

export function modifyPostAfterCreation(post, postHTML)
{   
    // Display comments 
    if(post.comments != null && post.comments.length > 0)
    {
        displayComments(postHTML, post.comments);
    }

    const seenStoryButton = postHTML.find('.seen-story-btn').first();

    // User not logged in...
    if(!$('#loggedUserName').val())
    {
        // Give comments inactive look
        $(postHTML).find('.comment-button').addClass('inactive');
        $(postHTML).find('.comment-button').attr('title', 'Only logged-in users can leave comments');

        // Make stars look inactive
        $(postHTML).find('.fa-star').addClass('inactive');
        $(postHTML).find('.fa-star').attr('title', 'Only logged-in users can give rating');

        // Make "Story Read" button look inactive
        seenStoryButton.addClass('inactive');
        seenStoryButton.attr('title', 'Only logged-in users can mark stories as read');
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

        //Set the "Story Read" button
        if(post.isRead)
        {
            seenStoryButton.addClass('read');
        }
    }
}

export function deleteStory(storyId) {
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

export function toggleAddCommentBox(buttonElement) {
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

export function toggleComments(buttonElement) {
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

export function addComment(buttonElement) {
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

export function generateCommentHTML(comment) {
    const date = new Date(comment.date)
    const formattedDate = `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    const commentDiv = $('<div>').addClass('comment');
    const commentAuthor = $('<span>').addClass('comment-author').text(comment.author);
    const commentDate = $('<span>').addClass('comment-date').text(formattedDate);
    const commentContent = $('<p>').addClass('comment-content').text(he.decode(comment.content));

    commentDiv.append(commentAuthor, commentDate, commentContent);
    return commentDiv;
}

export function displayComments(postElement, comments) {
    const commentsSection = postElement.find('.comments-section');
    commentsSection.empty(); // Clear previous comments to avoid duplication

    comments.forEach(comment => {
        let commentDiv = generateCommentHTML(comment);
        commentsSection.append(commentDiv);
    });
}

export function rateStory(starElement) {
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

export function highlightStars(container, rating) {
    container.querySelectorAll("i").forEach(star => {
        star.classList.remove("fas");
        star.classList.add("far");
        if (parseInt(star.dataset.value) <= rating) {
            star.classList.add("fas");
        }
    });
}

export function markAsRead(button)
{
    // Let the server know that user has marked/unmarked the story as read
    const storyId = $(button).closest('.post').find('.post-id').val();
    const isRead = $(button).hasClass('read');

    console.log(`StoryID: ${storyId}`)

    $.ajax({
        url: '/updateReadStatus',
        method: 'POST',
        data: {
            storyId: storyId,
            isRead: !isRead
        },
        success: function(response) {
            // Toggle the button's 'read' class
            $(button).toggleClass('read');
            console.log(response.message);
        },
        error: function(err) {
            console.error('Error updating read status:', err);
            alert('There was an error updating the read status.');
        }
    });
}

//#endregion Post Creation Functions

window.markAsRead = markAsRead
window.toggleAddCommentBox = toggleAddCommentBox
window.deleteStory = deleteStory
window.toggleComments = toggleComments
window.addComment = addComment