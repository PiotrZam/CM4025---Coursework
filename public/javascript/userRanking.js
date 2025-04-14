// Importing login status functions
import {checkLoggedIn, setUpLogoutLink, genres_enum} from './allPages.js'

$(document).ready(async function() {

    // Check login status & update it in UI
    await checkLoggedIn();
    setUpLogoutLink();

    var loggedIn = ($('#loggedUserName').val() ? true : false)
    console.log(`Logged in: ${loggedIn}`)

    // Set up top-authors / top-readers toggle button
    $(".toggle-btn").on("click", function() {
        const currentValue = $('#top-users-current-filter').val()
        const newValue = $(this).data("state");
        if(currentValue == newValue)
            return;

        // Remove active class from all buttons
        $(".toggle-btn").removeClass("active");

        // Add active class to the clicked button
        $(this).addClass("active");
        $('#top-users-current-filter').val(newValue);

        console.log("Current Filter State: ", currentValue);
        console.log("New  Filter State: ", newValue);

        if(newValue !== currentValue)
        {
            if(newValue === 'authors')
            {
                $('#reader-rank-cont').hide()
                $('#auth-rank-cont').show()
            }

            if(newValue === 'readers')
            {
                $('#auth-rank-cont').hide()
                $('#reader-rank-cont').show()
            }
        }
    });

    // Get top authors
    $.ajax({
        url: '/topAuthors',
        method: 'GET',
        success: function(data) {
            console.log("Fetched top ranked users:");
            console.log(data);

            var topUsersListDiv = $('#auth-rank-lst');
            data.forEach(user => {
                var userDiv = $('<div>', {
                    class: 'auth-rank-row topusr-row'
                });

                // Rank
                var rank = $('<div>', {class: 'topusr-rank'});
                const rankVal = `<h2 class="topusr-rank-val">#${user.rank}</h2>`
                rank.append(rankVal);
                userDiv.append(rank);

                // Username
                var username = $('<div>', {class: 'topusr-username'});
                const usernameVal = `<h2 class="topusr-username-val">${user.username}</h2>`
                username.append(usernameVal);
                userDiv.append(username);

                // Rating stars
                const starsContainer = $('<div>', { class: 'rating-stars topusr-stars' });
                const totalStars = 5;
                const fullStars = Math.floor(user.avgAuthorRating);
                const halfStars = Math.round(user.avgAuthorRating - fullStars);

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

                // Add stars to te user row
                userDiv.append(starsContainer);

                // Average Rating
                var avgRating = $('<div>', {class: 'topusr-avg-rating'});
                var avgRatingVal = `<p class="topusr-avg-rating-val">Average Story Rating: ${user.avgAuthorRating}<p>`;
                avgRating.append(avgRatingVal)
                userDiv.append(avgRating)

                // Number of Stories
                var numStories = $('<div>', {class: 'topusr-num-stor'});
                var numStoriesVal = `<p class="topusr-num-stor-val">Uploaded Stories: ${user.totalStories}<p>`;
                numStories.append(numStoriesVal)
                userDiv.append(numStories)

                // Number of ratings received
                var numRatings = $('<div>', {class: 'topusr-num-rat'});
                var numRatingsVal = `<p class="topusr-num-rat-val">Ratings received: ${user.totalRatings}<p>`;
                numRatings.append(numRatingsVal)
                userDiv.append(numRatings)

                topUsersListDiv.append(userDiv);
            });
        },
        error: function(xhr, status, error) {
            var errorString = `Error occured when trying to fetch top authors data:\n${xhr.responseJSON.error || error}`;
            console.log(errorString)
            alert(errorString);
        }
    });
   

    // Get top readers
    $.ajax({
        url: '/topReaders',
        method: 'GET',
        success: function(data) {
            console.log("Fetched top ranked readers:");
            console.log(data);

            var topUsersListDiv = $('#reader-rank-lst');
            data.forEach(user => {
                var userDiv = $('<div>', {
                    class: 'reader-rank-row topusr-row'
                });

                // Rank
                var rank = $('<div>', {class: 'reader-rank'});
                const rankVal = `<h2 class="reader-rank-val">#${user.rank}</h2>`
                rank.append(rankVal);
                userDiv.append(rank);

                // Username
                var username = $('<div>', {class: 'reader-username'});
                const usernameVal = `<h2 class="reader-username-val">${user.username}</h2>`
                username.append(usernameVal);
                userDiv.append(username);

                // Rated Stories
                var totalRatingsGiven = $('<div>', {class: 'reader-tot-rat-gvn '});
                var totalRatingsGivenVal = `<p class="reader-tot-rat-gvn-val">Rated Stories: ${user.totalRatingsGiven}<p>`;
                totalRatingsGiven.append(totalRatingsGivenVal)
                userDiv.append(totalRatingsGiven)

                // Added Comments
                var adedComments = $('<div>', {class: 'reader-num-comm'});
                var adedCommentsVal = `<p class="reader-num-comm-val">Added Comments: ${user.commentsCount}<p>`;
                adedComments.append(adedCommentsVal)
                userDiv.append(adedComments)

                topUsersListDiv.append(userDiv);
            });
        },
        error: function(xhr, status, error) {
            var errorString = `Error occured when trying to fetch top readers data:\n${xhr.responseJSON.error || error}`;
            console.log(errorString)
            alert(errorString);
        }
    });
});

//////////