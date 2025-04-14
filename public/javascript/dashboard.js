// Import functions:
import {checkLoggedIn, setUpLogoutLink, genres_enum, createPostElement, modifyPostAfterCreation, deleteStory, toggleAddCommentBox, toggleComments, addComment, getCurrentDate, generateCommentHTML, displayComments, rateStory, highlightStars, markAsRead, claimStory} from './allPages.js'

// dashboard.js
const dashboard = $(".dashboard");
const postsWrapper = $("#posts-wrapper");

$(document).ready(async function () {

    // Check login status & update it in UI
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
    
    // set up onClick event listeners for filters
    setUpFilters();

     // Fetch posts when the page is loaded or refreshed
     fetchPosts();

    // Attach event delegation to the parent container
    $(postsWrapper).on("click", ".fa-star", function () {
        console.log("Clicked to rate");
        rateStory(this);
    });   

});
// End of document.ready


// Sets up the story filters on the main story dashboard: Read/Unread/All & Genre
function setUpFilters() {

    // if user isn't logged in, don't display the "Story Read" filter
    if(!$('#loggedUserName').val())
    {
         $('.seen-story-filter').hide()
    }

    // If a user is logged in add event listener
    else 
    {
        $(".toggle-btn").on("click", function() {
            const currentValue = $('#seen-story-current-filter').val()
            const newValue = $(this).data("state");
            if(currentValue == newValue)
                return;

            // Remove active class from all buttons
            $(".toggle-btn").removeClass("active");

            // Add active class to the clicked button
            $(this).addClass("active");
            $('#seen-story-current-filter').val(newValue);

            console.log("Current Filter State: ", currentValue);
            console.log("New  Filter State: ", newValue);
        });
    }

    // Execute the below regardless of the login status:

    populateGenreDropdown()

    // Handle genre selection change and update hidden input
    $(".dropdown-options input[type='checkbox']").on("change", function() {

        // Get all checked checkboxes
        const selectedGenres = [];
        $(".dropdown-options input[type='checkbox']:checked").each(function() {
            selectedGenres.push($(this).val());  // Push the value of each checked checkbox
        });
    
        // Update the hidden field with the selected genres (joined as a comma-separated string)
        $('#genre-current-filter').val(selectedGenres.join(','));
    
        // Log selected genres to console for debugging
        console.log("Selected Genres: ", selectedGenres);
    });
    

    // Toggle visibility of the genre dropdown
    $('#toggle-genre').on('click', function() {
        $('#genre-dropdown').toggle();
    });

    // hide the genre dropdown if user clicked anywhere else in the document
    $(document).on('click', function(event) {
        const $dropdown = $('#genre-dropdown');
        const $toggleButton = $('#toggle-genre');
    
        // If the click was outside the dropdown and toggle button
        if (
            !$dropdown.is(event.target) &&
            $dropdown.has(event.target).length === 0 &&
            !$toggleButton.is(event.target)
        ) {
            $dropdown.hide();
        }
    });

    // Add event listener to the "Filter" button
    $('#apply-filters-btn').on('click', function() {
        const selectedGenres = $('#genre-current-filter').val();
        const seenStoryFilter = $('#seen-story-current-filter').val()
        console.log("About to make a request using these genre filters: ", selectedGenres, " and the following seenStory mode: ", seenStoryFilter);

        fetchPosts(seenStoryFilter, selectedGenres);
    });
}


// Used to populate the genre dropdown for the "genre" filter
function populateGenreDropdown() {
    const dropdownOptions = $(".dropdown-options");  // Target the dropdown container
    dropdownOptions.empty();  // Clear any existing content

    genres_enum.forEach(genre => {
        // Create a label with a checkbox for each genre
        const label = $('<label></label>').html(`
            <input type="checkbox" value="${genre}" /> ${genre}
        `);

        // Append each label to the dropdown options container
        dropdownOptions.append(label);
    });
}

// Fetches posts on the main dashboard
function fetchPosts(readFilterOption="all", genresFilter="") {

    var urlString = `/getPosts?readfilter=${readFilterOption}`
    if(genresFilter)
    {
        urlString += `&genre=${genresFilter}`
    } 

    // Fetch posts from the server using jQuery AJAX
    $.ajax({
        url: urlString,
        type: "GET",
        dataType: "json",
        success: function (posts) {
            // Clear existing posts from the the wrapper
            postsWrapper.empty();

            console.log(posts)

            // Add each post to the the wrapper
            posts.forEach(function (post) {
                var postHTML = createPostElement(post);
                console.log(post.thisUserRating);

                modifyPostAfterCreation(post, postHTML);
                postsWrapper.append(postHTML);
            });
        },
        error: function(xhr, status, error) {
            var errorString = `Error occured when trying to claim a story:\n${xhr.responseJSON.error || error}`;
            console.log(errorString)
            alert(errorString);
        }
    });
}

