// This is now called in individual js files.The functions are exported

// $(document).ready(function () {   
//     checkLoggedIn();
//     setUpLogoutLink();
// }); 


function checkLoggedIn()
{
     // Check if user is logged in
    $.ajax({
        url: "/checkLoggedIn",
        type: "GET",
        success: function(response) {
            if (response.loggedIn) {
                setUsername(response.username);
            } else {
                clearUsername();
            }
        },
        error: function() {
            clearUsername();
        }
    });
}

function setUsername(username)
{
    // User is logged in, display the username
    $('#user-status-text').text(username);
    $('#logout-link').show();  // Show the log out link
    $('#loggedUserName').val(username); // set to hidden input field

    // Remove the click event handler for "Log in" text if user is logged in
    $('#user-status-text').off('click');
}

function clearUsername()
{
    // User is not logged in, display "Log in"
    $('#user-status-text').text('Log in');
    $('#logout-link').hide();
    $('#loggedUserName').val(''); // clear hidden input field

    // Add a click listener to the "Log in" text
    $('#user-status-text').on('click', function() {
        window.location.href = 'login.html';  // Redirect to the login page
    });
}

function setUpLogoutLink() {
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
}