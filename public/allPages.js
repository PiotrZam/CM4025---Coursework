$(document).ready(function () {   
    
    // Check if user is logged in
    $.ajax({
        url: "/checkLoggedIn",
        type: "GET",
        success: function(response) {
            if (response.loggedIn) {
                // User is logged in, display the username
                $('#user-status-text').text(`${response.username}`);
                $('#logout-link').show();  // Show the log out link
    
                // Remove the click event handler for "Log in" text if user is logged in
                $('#user-status-text').off('click');
            } else {
                // User is not logged in, display "Log in"
                $('#user-status-text').text('Log in');
                $('#logout-link').hide();
    
                // Add a click listener to the "Log in" text
                $('#user-status-text').on('click', function() {
                    window.location.href = 'login.html';  // Redirect to the login page
                });
            }
        },
        error: function() {
            $('#user-status-text').text('Log in');
            $('#user-status-text').on('click', function() {
                window.location.href = 'login.html';  // Redirect to the login page
            });
            $('#logout-link').hide();  // Hide the log out link in case of an error
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
}); 