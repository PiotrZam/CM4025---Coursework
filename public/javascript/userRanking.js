// Importing login status functions
import {checkLoggedIn, setUpLogoutLink, genres_enum} from './allPages.js'

$(document).ready(async function() {
    await checkLoggedIn();
    setUpLogoutLink();

    var loggedIn = ($('#loggedUserName').val() ? true : false)
    console.log(`Logged in: ${loggedIn}`)
   
});

//////////