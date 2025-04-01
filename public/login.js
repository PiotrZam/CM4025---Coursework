$(document).ready(function () {
    
    // Check if user is logged in
    $.ajax({
        url: "/checkLoggedIn",
        type: "GET",
        success: function(response) {
            if (response.loggedIn) {
                $('#user-status-text').text(`${response.username}`);
                $('#logout-link').show();  
                $('#sign-up-form-container').hide();  
                $('#login-form-container').hide();  
                $('#login-message-text').text(`Welcome ${response.username}!`);
                $('#login-message').show();
                // login-message-text
                
                $('#user-status-text').off('click'); // Remove the click event handler for "Log in"
            } else {
                $('#user-status-text').text('Log in');
                $('#logout-link').hide();
                $('#sign-up-form-container').show();  
                $('#login-form-container').show();
                $('#login-message-text').text(``);
                $('#login-message').hide();
    
                $('#user-status-text').on('click', function() { // Add a click listener to the "Log in" text
                    window.location.href = 'login.html';
                });
            }
        },
        error: function() {
            $('#user-status-text').text('Log in');
            $('#logout-link').hide();
            $('#sign-up-form-container').show();  
            $('#login-form-container').show();
            $('#login-message-text').text(``);
            $('#login-message').hide();

            $('#user-status-text').on('click', function() {
                window.location.href = 'login.html';  // Redirect to the login page
            });
        }
    });
    

    // add event handler to logout link
    $('#logout').click(function (event) {
        event.preventDefault();  // Prevent the default link behavior

        // Send a POST request to the server to log out
        $.ajax({
            url: '/logout',  // POST request to the logout route
            type: 'POST',    // Change type to POST
            success: function () {
                alert("You are now logged out")
                window.location.href = 'login.html'; // Redirect to login page
            },
            error: function () {
                alert('Failed to log out');
            }
        });
    });

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
