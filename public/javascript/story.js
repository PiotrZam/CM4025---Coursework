// Importing functions:
import {checkLoggedIn, setUpLogoutLink, genres_enum, createPostElement, modifyPostAfterCreation, deleteStory, toggleAddCommentBox, toggleComments, addComment, getCurrentDate, generateCommentHTML, displayComments, rateStory, highlightStars, markAsRead} from './allPages.js'

// Story element passed from the server
const story = document.getElementById('story-data').textContent;
const passedStory = JSON.parse(story);
const postsWrapper = $("#posts-wrapper");

$(document).ready(async function () {

    
    console.log("Story: ")
    console.log(passedStory)

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

    // Create story HTML
    var postHTML = createPostElement(passedStory)
    modifyPostAfterCreation(passedStory, postHTML);
    postsWrapper.append(postHTML);

    if(loggedIn && !passedStory.isOwnStory)
    {
        // Attach event delegation to the parent container (ratings)
        $(postsWrapper).on("click", ".fa-star", function () {
        console.log("Clicked to rate");
        rateStory(this);
    });
    }
});
// End of document.ready
