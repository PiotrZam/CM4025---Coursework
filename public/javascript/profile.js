// Importing login status functions
import {checkLoggedIn, setUpLogoutLink, genres_enum} from './allPages.js'

$(document).ready(async function() {
    await checkLoggedIn();
    setUpLogoutLink();

    var loggedIn = ($('#loggedUserName').val() ? true : false)
    console.log(`Logged in: ${loggedIn}`)

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
                        starsContainer.append($('<i>', { class: 'fas fa-star prof-usr-star filled' }));
                    }

                    // Add half stars
                    if (halfStars > 0) {
                        starsContainer.append($('<i>', { class: 'fas fa-star-half-alt prof-usr-star filled' }));
                    }

                    // Add empty stars
                    for (let i = fullStars + halfStars; i < totalStars; i++) {
                        starsContainer.append($('<i>', { class: 'fas fa-star prof-usr-star' }));
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
                    const ratingInfo = $('<div>', { class: 'prof-usr-story-rating' })
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

   
});

//////////