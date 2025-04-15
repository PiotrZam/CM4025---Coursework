// Importing login status functions
import {checkLoggedIn, setUpLogoutLink, genres_enum} from './allPages.js'

// Consts:
const postForm = $("#post-form");

$(document).ready(async function () {

    // Check login status & update it in UI
    await checkLoggedIn();
    setUpLogoutLink();

    // Make the chexkbox for public/private stories disabled if the user is not logged in
    var loggedIn = ($('#loggedUserName').val() ? true : false)
    if(!loggedIn)
    {
        $('#post-public').prop('checked', true)
        $('#post-public').prop('disabled', true);
    }

    // populate genre dropdown in the add-story form
    populateGenres();

    // bind sending-post to the submit button
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
                var confirmationText = "Added a story!"

                // reset form fields
                resetFormAfterSubmission();

                if(post.claimCode)
                {
                    confirmationText += `\n\nYou can use the following code to claim the story as a logged in user in the future:`
                    + `\n${post.claimCode}`
                }

                alert(confirmationText);
            },
            error: function(xhr, status, error) {
                var errorString = `Error adding post:\n${xhr.responseJSON.error || error}`;
                console.log(errorString)
                alert(errorString);
            }
        });
    });

});


function resetFormAfterSubmission() {
    $("#post-title").val('');
    $("#post-content").val('');
    $("#post-genre").val('');
    $("#post-image").val(null); // Clear file input
    $("#post-public").prop('checked', true);

    // Reset reCAPTCHA
    grecaptcha.reset();
}

// Populates the genre dropdown when adding a new story
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