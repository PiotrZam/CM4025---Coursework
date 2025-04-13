// Importing login status functions
import {checkLoggedIn, setUpLogoutLink, genres_enum} from './allPages.js'

$(document).ready(async function() {
    await checkLoggedIn();
    setUpLogoutLink();

    var loggedIn = ($('#loggedUserName').val() ? true : false)
    console.log(`Logged in: ${loggedIn}`)

    $.ajax({
        url: '/topStories', // Make sure this matches your API endpoint
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
        error: function(xhr, status, error) {
            var errorString = `Error occured when trying to fetch stories:\n${xhr.responseJSON.error || error}`;
            console.log(errorString)
            alert(errorString);
        }
    });
});

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