$(document).ready(function () {

    // Sign up form
    $('#sign-up-form').submit(function (event) {
        event.preventDefault(); // Prevent default form submission

        // Get form values
        var username = $('#username').val();
        var password = $('#password').val();

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
            },
            error: function (error) {
                alert(error.responseJSON.error);
            }
        });
    });
   
    // // Login form
    // const loginForm = document.querySelector("#login-form");
    // loginForm.addEventListener("submit", function (event) {
    //     event.preventDefault();
    //     const username = loginForm.querySelector("#username").value;
    //     const password = loginForm.querySelector("#password").value;

    //     // Create a JSON object with the credentials
    //     const credentials = { username, password };

    //     // Make an AJAX request to the server for authentication with proper headers
    //     fetch("/login", {
    //         method: "POST",
    //         headers: {
    //             "Content-Type": "application/json", // Set the content type to JSON
    //         },
    //         body: JSON.stringify(credentials), // Send the JSON object
    //     })
    //         .then((response) => {
    //             if (response.status === 200) {
    //                 return response.json();
    //             } else {
    //                 throw new Error("Authentication failed");
    //             }
    //         })
    //         .then((data) => {
    //             alert("Login successful! Redirect to the dashboard or perform further actions.");
    //             // Redirect to the dashboard or perform other actions here.
    //             window.location.href = "/index.html";
    //         })
    //         .catch((error) => {
    //             alert("Invalid username or password. Please try again.");
    //             console.error(error);
    //         });
    // });
}); 
