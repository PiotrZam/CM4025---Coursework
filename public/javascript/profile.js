// Importing login status functions
// import {checkLoggedIn, setUpLogoutLink, genres_enum} from './allPages.js'

$(document).ready(async function() {

     // Check if user is logged in
    $.ajax({
        url: "/checkLoggedIn",
        type: "GET",
        success: function(response) {
            if (response.loggedIn) {
                setUsername(response.username);
                $('#profile-wrapper').show();
                getUserContent();
            } else {
                clearUsername();
                $('#signup-login-form-wrapper').show();
            }
        },
        error: function() {
            clearUsername();
        }
    });
    
   bindButtons();
    
});


function setUsername(username) 
    {
        $('#user-status-text').text(username);
        $('#logout-link').show();  
        $('#sign-up-form-container').hide();  
        $('#login-form-container').hide();  
        $('#login-message-text').text(`Welcome ${username}`);
        $('#login-message').show();
        $('#loggedUserName').val(username); // set to hidden input field
        // login-message-text
        
        $('#user-status-text').css('cursor', 'default');
        // Remove on hover effect
        $('#user-status').addClass('signedIn');
        $('#user-status').removeClass('signedOut');

        $('#user-status-text').off('click'); // Remove the click event handler for "Log in"
}

function clearUsername()
    {
        $('#user-status-text').text('Log in');
        $('#logout-link').hide();
        $('#sign-up-form-container').show();  
        $('#login-form-container').show();
        $('#login-message-text').text(``);
        $('#login-message').hide();
        $('#loggedUserName').val(``);

        $('#user-status').removeClass('signedIn');
        $('#user-status').addClass('signedOut');

        $('#user-status-text').on('click', function() { // Add a click listener to the "Log in" text
            window.location.href = 'profile.html';
        });
}

function bindButtons() {
    // add event handler to logout link
    $('#logout').click(function (event) {
        event.preventDefault();  // Prevent the default link behavior

        // Send a POST request to the server to log out
        $.ajax({
            url: '/logout',  // POST request to the logout route
            type: 'POST',    // Change type to POST
            success: function () {
                alert("You are now logged out")
                window.location.href = 'profile.html'; // Redirect to login page
            },
            error: function () {
                alert('Failed to log out');
            }
        });
    });

    // Sign up form
    $('#sign-up-form').submit(function (event) {
        event.preventDefault(); // Prevent default form submission

        // Get form values
        var username = $('#sign-up-username').val();
        var password = $('#sign-up-password').val();

        // Optionally, get reCAPTCHA response (if using reCAPTCHA)
        const recaptchaResponse = grecaptcha.getResponse(); // Only if you have reCAPTCHA

        // Create data to send to the backend
        const data = {
            username,
            password,
            recaptchaResponse
        };

        // Send data to the backend
        $.ajax({
            url: '/signUp',
            type: 'POST',
            data: JSON.stringify(data),
            contentType: 'application/json',
            success: function (response) {
                alert(response.message);
                $('#sign-up-form')[0].reset(); // clear the form fields
                grecaptcha.reset(); // Reset the reCAPTCHA widget
                window.location.href = 'profile.html'; // Redirect
            },
            error: function (error) {
                $('#sign-up-password').val(''); // clear the password field
                alert(error.responseJSON.error);
            }
        });
    });
   
    // Sign-in form
    $('#login-form').submit(function (event) {
        event.preventDefault(); // Prevent the default form submission

        // Get form values
        const username = $('#sign-in-username').val();
        const password = $('#sign-in-password').val();

        // Create data to send to the backend
        const data = {
            username,
            password
        };

        // Send login request to the backend
        $.ajax({
            url: '/login', // Your login route in the backend
            type: 'POST',
            data: JSON.stringify(data),
            contentType: 'application/json',
            success: function (response) {
                alert(response.message); // Show success message
                // Reset the form after successful login
                $('#login-form')[0].reset(); // This will clear the form fields
                window.location.href = 'profile.html'; // Redirect
            },
            error: function (error) {
                $('#sign-in-password').val(''); // clear the password field
                // Handle error response
                alert(error.responseJSON.error); // Show error message if something went wrong
            }
        });
    });
}

function getUserContent() {
    // Get user's  stories and stats
    $.ajax({
        url: '/currentUsersStories', // Make sure this matches your API endpoint
        method: 'GET',
        success: function(data) {
            console.log("Fetched user stories:");
            console.log(data);

            // Profile Stats - insert values
            $('#profile-stats-rating-val').text((data.avgStoryRating) ? (data.avgStoryRating) : 0)
            $('#profile-stats-num-stories-val').text((data.numStories) ? (data.numStories) : 0)
            $('#profile-stats-read-stories-val').text((data.numStoriesRead) ? (data.numStoriesRead) : 0)
            $('#profile-stats-ratings-rec-val').text((data.ratingsReceived) ? (data.ratingsReceived) : 0)
            $('#profile-stats-ratings-gvn-val').text((data.ratingsGiven) ? (data.ratingsGiven) : 0)

            //User's Stories - populate list
            var userStoriesDiv = $('#cur-usr-stor-list');

            if(!data.stories || data.stories.length == 0)
            {
                userStoriesDiv.append('<p>User hasn\'t uploaded any stories yet.</p>');
            } else {
                data.stories.forEach(story => {
                    var storyDiv = $('<div>', {
                        class: 'prof-usr-story prof-row'
                    });

                    const storyIdHidden = `<input type="hidden" class="post-id" value="${story._id}">`
                    storyDiv.append(storyIdHidden);

                    // Rating stars
                    const starsContainer = $('<div>', { class: 'prof-usr-story-stars' });
                    const totalStars = 5;
                    const fullStars = Math.floor(story.averageRating);
                    const halfStars = Math.round(story.averageRating - fullStars); 

                    // Add full stars
                    for (let i = 0; i < fullStars; i++) {
                        starsContainer.append($('<i>', { class: 'fas fa-star rating-star filled' }));
                    }

                    // Add half stars
                    if (halfStars > 0) {
                        starsContainer.append($('<i>', { class: 'fas fa-star-half-alt rating-star filled' }));
                    }

                    // Add empty stars
                    for (let i = fullStars + halfStars; i < totalStars; i++) {
                        starsContainer.append($('<i>', { class: 'fas fa-star rating-star' }));
                    }

                    storyDiv.append(starsContainer);

                    // Title link element
                    const titleLink = $('<a>', {
                        class: 'prof-usr-story-title',
                        href: `/getSingleStory?storyID=${story._id}`,
                        text: story.title
                    });
                    storyDiv.append(titleLink);

                    // Ranking details below the stars
                    const ratingInfo = $('<div>', { class: 'prof-usr-story-rating-info' })
                        .html(`Avg: ${story.averageRating.toFixed(1)}<br/>${story.numRatings} Ratings`);
                        storyDiv.append(ratingInfo);

                    // Other details: genre, author, date
                    const otherDetailsDiv = $('<div>', { class: 'prof-usr-story-other-det' });

                    // Genre below the title
                    const genreDiv = $('<div>', { class: 'prof-usr-story-genre' }).text(`Genre: ${story.genre}`);
                    otherDetailsDiv.append(genreDiv);

                    // Author and date below the title
                    const authorDiv = $('<div>', { class: 'prof-usr-story-author' }).text(`By ${story.author}`);
                    const dateDiv = $('<div>', { class: 'prof-usr-story-date' }).text(`Date: ${story.date}`);
                    otherDetailsDiv.append(authorDiv);
                    otherDetailsDiv.append(dateDiv);

                    storyDiv.append(otherDetailsDiv);

                    userStoriesDiv.append(storyDiv);
                });
            }
        },
        error: function(error) {
            console.log("Error fetching stories:", error);
        }
    });
}

