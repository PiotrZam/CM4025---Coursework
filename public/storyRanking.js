$(document).ready(async function() {
    await checkLoggedIn();
    setUpLogoutLink();

    var loggedIn = ($('#loggedUserName').val() ? true : false)
    console.log(`Logged in: ${loggedIn}`)

    $.ajax({
        url: '/top-stories', // Make sure this matches your API endpoint
        method: 'GET',
        success: function(data) {
            data.forEach((story, index) => {
                // Create the HTML for each story container
                const topStoryContainer = $('<div>', { class: 'top-story-container' });

                const storyIdHidden = `<input type="hidden" class="post-id" value="${story._id}">`
                topStoryContainer.append(storyIdHidden);

                // Ranking number
                const rankingNo = $('<div>', { class: 'top-stories-rankingno' }).text(`#${index + 1}`);
                topStoryContainer.append(rankingNo);

                // Rating stars
                const ratingContainer = $('<div>', { class: 'top-stories-stars' });
                const totalStars = 5;
                const fullStars = Math.floor(story.averageRating);
                const halfStars = Math.round(story.averageRating - fullStars);

                // Add full stars
                for (let i = 0; i < fullStars; i++) {
                    ratingContainer.append($('<i>', { class: 'fas fa-star top-star filled' }));
                }

                // Add half stars
                if (halfStars > 0) {
                    ratingContainer.append($('<i>', { class: 'fas fa-star-half-alt top-star filled' }));
                }

                // Add empty stars
                for (let i = fullStars + halfStars; i < totalStars; i++) {
                    ratingContainer.append($('<i>', { class: 'fas fa-star top-star' }));
                }

                // Append the stars container to the story container
                topStoryContainer.append(ratingContainer);

                // Title link element
                const titleLink = $('<a>', {
                    class: 'top-stories-title',
                    href: `/getSingleStory?storyID=${story._id}`,
                    text: story.title
                });
                topStoryContainer.append(titleLink);

                // Ranking details below the stars
                const ratingInfo = $('<div>', { class: 'top-stories-rating-info' })
                    .html(`Avg: ${story.averageRating.toFixed(1)}<br/>${story.numRatings} Ratings`);
                topStoryContainer.append(ratingInfo);

                // Other details: genre, author, date
                const otherDetailsDiv = $('<div>', { class: 'top-stories-other-details' });

                // Genre below the title
                const genreDiv = $('<div>', { class: 'top-stories-genre' }).text(`Genre: ${story.genre}`);
                otherDetailsDiv.append(genreDiv);

                // Author and date below the title
                const authorDiv = $('<div>', { class: 'top-stories-author' }).text(`By ${story.author}`);
                const dateDiv = $('<div>', { class: 'top-stories-date' }).text(`Date: ${story.date}`);
                otherDetailsDiv.append(authorDiv);
                otherDetailsDiv.append(dateDiv);

                topStoryContainer.append(otherDetailsDiv);

                // Append the full story container to the main list
                $('#top-stories-list').append(topStoryContainer);
            });
        },
        error: function(error) {
            console.log("Error fetching stories:", error);
        }
    });
});


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

///////////
// Function to generate the HTML for the ranking
function generateStoryRanking(stories) {
    const storyRankingContainer = $('#story-ranking');
    storyRankingContainer.empty();  // Clear any previous content

    stories.forEach((story, index) => {
        // Create star rating HTML based on the average rating
        const starsHtml = generateStars(story.averageRating);

        // Create the story ranking HTML
        const storyHtml = `
            <div class="story">
                <h3>#${index + 1} ${story.title}</h3>
                <div class="stars">${starsHtml}</div>
                <p><strong>Author:</strong> ${story.author}</p>
                <p><strong>Average Rating:</strong> ${story.averageRating} (${story.numRatings} ratings)</p>
            </div>
        `;

        // Append the story to the ranking container
        storyRankingContainer.append(storyHtml);
    });
}

// Function to generate star rating HTML
function generateStars(rating) {
    const filledStars = Math.floor(rating);
    const halfStar = (rating % 1) >= 0.5;
    const emptyStars = 5 - filledStars - (halfStar ? 1 : 0);

    let starsHtml = '';
    for (let i = 0; i < filledStars; i++) {
        starsHtml += `<i class="fa fa-star" style="color: gold;"></i>`;
    }
    if (halfStar) {
        starsHtml += `<i class="fa fa-star-half-alt" style="color: gold;"></i>`;
    }
    for (let i = 0; i < emptyStars; i++) {
        starsHtml += `<i class="fa fa-star" style="color: gray;"></i>`;
    }

    return starsHtml;
}