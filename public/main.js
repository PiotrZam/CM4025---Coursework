// Importing login status functions
import {checkLoggedIn, setUpLogoutLink, genres_enum, createPostElement, modifyPostAfterCreation, deleteStory, toggleAddCommentBox, toggleComments, addComment, getCurrentDate, generateCommentHTML, displayComments, rateStory, highlightStars, markAsRead} from './allPages.js'

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
    
    // set up onClick event listeners for filters
    setUpFilters();

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
                console.log("Added a post!")

                var postInput = {
                    _id: post._id,
                    author: post.author,
                    genre: post.genre,
                    date: post.date,
                    title: post.title,
                    content: post.content,
                    numRatings: 0,
                    averageRating: 0,
                    comments: 0,
                    imageUrl: post.imageUrl,
                    isPublic: post.isPublic,
                    isOwnStory: post.isOwnStory,
                    isRead: false
                }

                // Create new post element (ensure backend sends back the image URL)
                var postHTML = createPostElement(postInput);
    
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
        error: function () {
            console.error("Error fetching posts from the server.");
        }
    });
}

function populateGenres() {

    // Get the genre select element using jQuery
    const genreSelect = $('#post-genre');

    // Clear any existing options before appending new ones
    genreSelect.empty();

    // Populate the select element with genre options using jQuery
    genres_enum.forEach(genre => {
        const option = $('<option></option>').val(genre).text(genre);
        genreSelect.append(option);
    });
}
