// Importing login status functions
import {checkLoggedIn, setUpLogoutLink, genres_enum} from './allPages.js'

// Consts:
const postForm = $("#post-form");

$(document).ready(async function () {

    await checkLoggedIn();
    setUpLogoutLink();

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

                if(post.claimCode)
                {
                    confirmationText += `\n\nYou can use the following code to claim the story as a logged in user in the future:`
                    + `\n${post.claimCode}`
                }

                alert(confirmationText);
            },
            error: function () {
                alert("Error adding post. Please try again.");
            }
        });
    });

});

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