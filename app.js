const express = require('express');
const request = require('request-promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
const port = process.env.PORT || 3000;
const steamApiKey = process.env.STEAM_API_KEY;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add a route to serve the HTML form
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'form.html')));


// ...

app.post('/compare-libraries', async (req, res) => {

    const { userInputs } = req.body;

    if (!userInputs || userInputs.length < 2 || userInputs.length > 5) {
        return res.status(400).json({ error: 'Invalid number of user inputs provided. Must be between 2 and 5.' });
    }

    try {
        const steamIds = await Promise.all(userInputs.map((input) => resolveSteamId(input)));
        const libraries = await Promise.all(steamIds.map((steamId) => getOwnedGames(steamId)));
        const commonGames = compareLibraries(libraries);

        res.json({ commonGames });
    } catch (error) {
        console.error('Error comparing libraries:', error.message);
        res.status(500).json({ error: 'An error occurred while comparing libraries.' });
    }
});

const resolveSteamId = async (identifier) => {
    const url = `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${steamApiKey}&vanityurl=${identifier}`;

    try {
        const response = await request(url);
        const data = JSON.parse(response);

        if (data.response.success === 1) {
            return data.response.steamid;
        }
    } catch (error) {
        console.error(`Error resolving Steam ID from vanity URL ${identifier}:`, error.message);
    }

    return identifier;
};

const getOwnedGames = async (steamId) => {
    const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${steamApiKey}&steamid=${steamId}&include_appinfo=1&format=json`;

    try {
        const response = await request(url);
        const data = JSON.parse(response);
        return data.response.games || [];
    } catch (error) {
        console.error(`Error fetching games for Steam ID ${steamId}:`, error.message);
        return [];
    }
};

const compareLibraries = (libraries) => {
    const [firstLibrary, ...restLibraries] = libraries;

    return firstLibrary.filter((game) =>
        restLibraries.every((library) => library.some((otherGame) => otherGame.appid === game.appid))
    );
};


// Add a route to display the results
app.get('/results', (req, res) => {
    res.send(`<pre>${JSON.stringify(req.commonGames, null, 2)}</pre>`);
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
