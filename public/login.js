$(document).ready(function () {
    
    // Sign up form
    $('#sign-up-form').submit(function (event) {
        event.preventDefault(); // Prevent default form submission

        // Get form values
        var username = $('#sign-up-username').val();
        var password = $('#sign-up-password').val();

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
                window.location.href = 'login.html'; // Redirect to login page
            },
            error: function (error) {
                $('#sign-up-password').val(''); // clear the password field
                alert(error.responseJSON.error);
            }
        });
    });
   
    // Sign-in form
    $('#login-form').submit(function (event) {
        event.preventDefault(); // Prevent the default form submission

        // Get form values
        const username = $('#sign-in-username').val();
        const password = $('#sign-in-password').val();

        // Create data to send to the backend
        const data = {
            username,
            password
        };

        // Send login request to the backend
        $.ajax({
            url: '/login', // Your login route in the backend
            type: 'POST',
            data: JSON.stringify(data),
            contentType: 'application/json',
            success: function (response) {
                alert(response.message); // Show success message
                // Reset the form after successful login
                $('#login-form')[0].reset(); // This will clear the form fields
                window.location.href = 'login.html'; // Redirect to login page
            },
            error: function (error) {
                $('#sign-in-password').val(''); // clear the password field
                // Handle error response
                alert(error.responseJSON.error); // Show error message if something went wrong
            }
        });
    });
}); 
