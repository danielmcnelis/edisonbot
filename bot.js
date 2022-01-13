
//EDISONBOT - A RANKINGS BOT FOR EDISONFORMAT.COM

//MODULE IMPORTS
const axios = require('axios')
const Discord = require('discord.js')
const fs = require('fs')
const { Op } = require('sequelize')
const FuzzySet = require('fuzzyset')

//DATABASE IMPORTS
const { Entry, Match, Matchup, Membership, Player, Role, Stats, Status, Tournament }  = require('./db/index.js')

//FUNCTION IMPORTS
const { checkDeckList, getDeckType } = require('./functions/deck.js')
const { uploadDeckFolder } = require('./functions/drive.js')
const { addSheet, makeSheet, writeToSheet } = require('./functions/sheets.js')
const { askForDBName, checkPairing, findNoShowOpponent, createSheetData, getDeckList, getDeckName, getTournamentType, getMatches, processMatchResult, postParticipant, removeParticipant, seed, selectTournament } = require('./functions/tournament.js')
const { assignRoles, capitalize, createMembership, createPlayer, fetchCardNames, getDeckCategory, getMedal, generateRandomString, isAdmin, isMod, isNewMember, isNewUser, isProgrammer, isTourPlayer } = require('./functions/utility.js')

// STATIC IMPORTS
const { welcomeChannel } = require('./static/channels.json')
const { client } = require('./static/clients.js')
const { botcom, bracketcom, dbcom, deckcom, dropcom, h2hcom, joincom, legalcom, banscom, losscom, manualcom, noshowcom, pfpcom, rankcom, rolecom, signupcom, startcom, statscom, undocom } = require('./static/commands.json')
const { sad, EF, dandy, legend } = require('./static/emojis.json')
const { rankedRole, tourRole } = require('./static/roles.json')
const { challongeAPIKey } = require('./secrets.json')
const fuzzyCards = FuzzySet([], false)

//READY
client.on('ready', async () => {
  console.log('EdisonBot is online!!')
  const names = await fetchCardNames()
  names.forEach((card) => fuzzyCards.add(card))
})

//WELCOME
client.on('guildMemberAdd', async (member) => {
    const channel = client.channels.cache.get(welcomeChannel)
    const guild = client.guilds.cache.get('711565397421457432')
    if (await isNewUser(member.user.id)) await createPlayer(member) 
    if (await isNewMember(guild.id, member.user.id)) {
        await createMembership(guild, member)
        return channel.send({ content: `${member}, Welcome to the EdisonFormat.com ${EF} discord server. ${dandy}`})
    } else {
        await assignRoles(guild, member)
        return channel.send({ content: `${member}, Welcome back to the EdisonFormat.com ${EF} discord server! We missed you. ${legend}`})
    }
})

//GOODBYE
client.on('guildMemberRemove', member => client.channels.cache.get(welcomeChannel).send({ content: `Oh dear. ${member.user.username} has left the server. ${sad}`}))

//COMMANDS
client.on('messageCreate', async (message) => {
    if (
		//no commands in DMs
		!message.guild || 
		//no commands from bots
		message.author.bot || 
		//do not allow users to parrot @everyone or @here with the bot
		message.content.includes('@everyone') || message.content.includes('@here') ||
		//only allow commands starting with !
		(!message.content.startsWith("!") && !message.content.includes(`{`) && !message.content.includes(`}`))
	) return

    const marr = message.content.split(" ")
	for(let i = 0; i < marr.length; i++) {
		if (marr[i] === '') { 
			marr.splice(i, 1)
			i--
		}
	}
    
    const cmd = marr[0].toLowerCase()
    const args = marr.slice(1)
    const maid = message.author.id
    const mgid = message.guild.id
    if (await isNewUser(maid)) await createPlayer(message.member)
    if (await isNewMember(mgid, maid)) await createMembership(message.guild, message.member)

    //CARD SEARCH USING CURLY BRACKETS
    if (!message.content.startsWith("!") && message.content.includes(`{`) && message.content.includes(`}`)) { 
        const query = message.content.slice(message.content.indexOf('{') + 1, message.content.indexOf('}'))
        const cardEmbed = await search(query, fuzzyCards)
        if (!cardEmbed) return message.channel.send({ content: `Could not find card: "${query}".`})
        else return message.channel.send({ embeds: [cardEmbed] })
    }

    //PING 
    if (cmd === `!ping`) return message.channel.send({ content: '🏓' })

    // TEST 
    if (cmd === `!test`) {
        if (isProgrammer(message.member)) {
            return message.channel.send({ content: `🧪` })
        } else {
            return message.channel.send({ content: `🧪` })
        }
    }

    // FIX 
    if (cmd === `!fix`) {
        if (isProgrammer(message.member)) {
            return message.channel.send({ content: `🛠️` })
        } else {
            return message.channel.send({ content: `🛠️` })
        }
    }

    //CREATE 
    if (cmd === `!create`) {
        if (!isMod(message.member)) return message.channel.send({ content: 'You do not have permission to do that.'})
        if (!args.length) return message.channel.send({ content: `Please provide a name for the new tournament.`})
        const tournament_type = await getTournamentType(message)
        if (!tournament_type) return message.channel.send({ content: `Please select a valid tournament type.`})
        if (!message.guild.channels.cache.get(tournament_channel)) return message.channel.send({ content: `Please provide a valid tournament channel.`})
        const str = generateRandomString(10, '0123456789abcdefghijklmnopqrstuvwxyz')
        const name = args[0].replace(/[^\w\s]/gi, "_").replace(/ /g,'')

        try {
            const { status, data } = await axios({
                method: 'post',
                url: `https://Chappell:${challongeAPIKey}@api.challonge.com/v1/tournaments.json`,
                data: {
                    api_key: challongeAPIKey,
                    tournament: {
                        name: name,
                        url: name,
                        tournament_type: tournament_type,
                        gameName: 'Yu-Gi-Oh!',
                    }
                }
            })
                
            if (status && data && status === 200) {
                await Tournament.create({ 
                    id: data.tournament.id,
                    name: data.tournament.name,
                    state: data.tournament.state,
                    rounds: data.tournament.swiss_rounds, 
                    type: data.tournament.tournament_type,
                    url: data.tournament.url,
                    guildId: mgid
                })

                fs.mkdir(`./decks/${name}`, (err) => {
                    if (err) {
                        return console.error(err)
                    }
                    console.log(`made new directory: ./decks/${name}`)
                })
            
                return message.channel.send({ content: 
                    `You created a new tournament:` + 
                    `\nName: ${data.tournament.name} ${dandy}` + 
                    `\nType: ${capitalize(data.tournament.tournament_type)}` +
                    `\nBracket: https://challonge.com/${data.tournament.url}`
                })
            }
        } catch (err) {
            console.log(err)
            try {
                const { status, data } = await axios({
                    method: 'post',
                    url: `https://Chappell:${challongeAPIKey}@api.challonge.com/v1/tournaments.json`,
                    data: {
                        api_key: challongeAPIKey,
                        tournament: {
                            name: name,
                            url: str,
                            tournament_type: tournament_type,
                            gameName: 'Yu-Gi-Oh!',
                        }
                    }
                })
                
                if (status && data && status === 200) {
                    await Tournament.create({ 
                        id: data.tournament.id,
                        name: data.tournament.name,
                        state: data.tournament.state,
                        rounds: data.tournament.swiss_rounds, 
                        type: data.tournament.tournament_type,
                        url: data.tournament.url,
                        guildId: mgid
                    })
                
                    fs.mkdir(`./decks/${name}`, (err) => {
                        if (err) {
                            return console.error(err)
                        }
                        console.log(`made new directory: ./decks/${name}`)
                    })

                    return message.channel.send({ content: 
                        `You created a new tournament:` + 
                        `\nName: ${data.tournament.name} ${dandy}` + 
                        `\nType: ${capitalize(data.tournament.tournament_type)}` +
                        `\nBracket: https://challonge.com/${data.tournament.url}`
                    })
                } 
            } catch (err) {
                console.log(err)
                return message.channel.send({ content: `Unable to create tournament on Challonge.com.`})
            }
        }
    }

    //DESTROY
    if (cmd === `!destroy`) {
        if (!isMod(message.member)) return message.channel.send({ content: 'You do not have permission to do that.'})
        if (!args.length) return message.channel.send({ content: `Please specify the name of the tournament you wish to destroy.`})

        const name = args[0]
        const tournament = await Tournament.findOne({ where: { name: { [Op.iLike]: name }, guildId: mgid } })
        if (!tournament) return message.channel.send({ content: `Could not find tournament: "${name}".`})
        if (tournament.state === 'underway') return message.channel.send({ content: `This tournament is underway, meaning it can only be deleted manually.`})
        if (tournament.state === 'complete') return message.channel.send({ content: `This tournament is archived, meaning it can only be deleted manually.`})
        const tournamentId = tournament.id
        const tournament_name = tournament.name

        try {
            const { status } = await axios({
                method: 'delete',
                url: `https://Chappell:${challongeAPIKey}@api.challonge.com/v1/tournaments/${tournament.id}.json`
            })
        
            if (status && status === 200) {
                const entries = await Entry.findAll({ where: { tournamentId: tournamentId }})
                for (let i = 0; i < entries.length; i++) {
                    const entry = entries[i]
                    const playerId = entry.playerId	
                    await entry.destroy()
                    const count = await Entry.count({ where: { playerId: playerId } })
                    if (count) {
                        continue
                    } else { 
                        const member = message.guild.members.cache.get(playerId)
                        if (!member) continue
                        member.roles.remove(tourRole)
                    }
                }
        
                await tournament.destroy()
                return message.channel.send({ content: `Yikes! You deleted ${tournament_name} ${dandy} from your Challonge account.`})
            } else {
                return message.channel.send({ content: `Unable to delete tournament from Challonge account.`})
            }
        } catch (err) {
            return message.channel.send({ content: `Error: Unable to delete tournament from Challonge account.`})
        }
    }

    //START
    if (startcom.includes(cmd)) {
        if (!isMod(message.member)) return message.channel.send({ content: 'You do not have permission to do that.'})
        const tournaments = await Tournament.findAll({ where: { state: 'pending', guildId: mgid }, order: [['createdAt', 'ASC']] })
		const tournament = await selectTournament(message, tournaments, maid)
		if (!tournament) return message.channel.send({ content: `There are no pending tournaments.`})
        const { name, id, url } = tournament
		const unregCount = await Entry.count({ where: { participantId: null, tournamentId: id } })
        if (unregCount) return message.channel.send({ content: 'One of more players has not been signed up. Please check the Database.'})
		const entryCount = await Entry.count({ where: { tournamentId: id } })
		if (!entryCount) return message.channel.send({ content: `Error: missing entrants.`})
		const { sheet1Data, sheet2Data } = await createSheetData(tournament)
		const success = await seed(message, tournament)
		if (!success) return message.channel.send({ content: `Error seeding tournament. Please try again or start it manually.`})

		const { status } = await axios({
			method: 'post',
			url: `https://Chappell:${challongeAPIKey}@api.challonge.com/v1/tournaments/${tournament.id}/start.json`
		})

		if (status === 200) { 
			tournament.state = 'underway'
			await tournament.save()
			const spreadsheetId = await makeSheet(`${name} Deck Lists`, sheet1Data)
			await addSheet(spreadsheetId, 'Summary')
			await writeToSheet(spreadsheetId, 'Summary', 'RAW', sheet2Data)
			await uploadDeckFolder(name)
			return message.channel.send({ content: `Let's go! Your tournament is starting now: https://challonge.com/${url} ${dandy}`})
		} else {
			return message.channel.send({ content: `Error: could not access Challonge.com.`})
		}
    }

    //END
    if (cmd === `!end`) {
        if (!isMod(message.member)) return message.channel.send({ content: 'You do not have permission to do that.'})
        if (!args.length) return message.channel.send({ content: `Please specify the name of the tournament you wish to end.`})
        const name = args[0]
        const tournament = await Tournament.findOne({ where: { name: { [Op.iLike]: name }}, guildId: mgid })
        if (tournament.state === 'complete') return message.channel.send({ content: `This tournament has already ended.`})
        if (!tournament) return message.channel.send({ content: `Could not find tournament: "${name}".`})
        const tournament_name = tournament.name

        const { status } = await axios({
            method: 'post',
            url: `https://Chappell:${challongeAPIKey}@api.challonge.com/v1/tournaments/${tournament.id}/finalize.json`
        })

        if (status && status === 200) {
            const entries = await Entry.findAll({ where: { tournamentId: tournament.id }})
            for (let i = 0; i < entries.length; i++) {
                const entry = entries[i]
                const playerId = entry.playerId	
                await entry.destroy()
                const count = await Entry.count({ where: { playerId: playerId } })
                if (count) {
                    continue
                } else { 
                    const member = message.guild.members.cache.get(playerId)
                    if (!member) continue
                    member.roles.remove(tourRole)
                }
            }

            await tournament.update({
                state: 'complete'
            })
            
            return message.channel.send({ content: `Congrats! The results of ${tournament_name} ${dandy} have been finalized.`})
        } else {
            return message.channel.send({ content: `Unable to finalize ${tournament.name} ${dandy} on Challonge.com.`})
        }
    }

    //BRACKET
    if (bracketcom.includes(cmd)) {
        const tournaments = await Tournament.findAll({ where: { state: { [Op.not]: 'complete'}, guildId: mgid }, order: [['createdAt', 'ASC']]})
        if (!tournaments.length) return message.channel.send({ content: `There are no active tournaments.`})
        
        const results = []
        for (let i = 0; i < tournaments.length; i++) {
            const tournament = tournaments[i]
            results.push(`Name: ${tournament.name} ${dandy}` +
                `\nType: ${capitalize(tournament.type)}` +
                `\nBracket: <https://challonge.com/${tournament.url}>`
            )
        }

        return message.channel.send({ content: results.join('\n\n').toString() })
    }

    //JOIN
    if(joincom.includes(cmd)) {        
        const mention = message.mentions.members.first()
        if (isMod(message.member) && mention) return message.channel.send({ content: `Please type **!signup @user** to register someone else for the tournament.`})
        const player = await Player.findOne({ where: { id: maid }})
        if (!player) return message.channel.send({ content: `You are not in the database.`})
        const tournaments = await Tournament.findAll({ where: { state: 'pending', guildId: mgid }, order: [['createdAt', 'ASC']] })
        const count = await Tournament.count({ where: { state: 'underway', guildId: mgid } })
        const tournament = await selectTournament(message, tournaments, maid)
        if (!tournament && count) return message.channel.send({ content: `Sorry, the tournament already started.`})
        if (!tournament && !count) return message.channel.send({ content: `There is no active tournament.`})
        const entry = await Entry.findOne({ where: { playerId: maid, tournamentId: tournament.id } })
        
        message.channel.send({ content: `Please check your DMs.`})
        const dbName = player.duelingBook ? player.duelingBook : await askForDBName(message.member, player)
        if (!dbName) return
        const deckListUrl = await getDeckList(message.member, player, tournament.name)
        if (!deckListUrl) return
        const deckName = await getDeckName(message.member, player)
        const deckType = await getDeckType(message.member, tournament.name)
        if (!deckType) return
        const deckCategory = getDeckCategory(deckType)
        if (!deckCategory) return

        if (!entry) {                                  
            const { participant } = await postParticipant(tournament, player)
            if (!participant) return message.channel.send({ content: `Error: Could not access tournament: ${tournament.name}`})
            
            const new_entry = await Entry.create({
                pilot: player.name,
                url: deckListUrl,
                deck_name: deckName || deckType,
                deck_type: deckType,
                deck_category: deckCategory,
                participantId: participant.id,
                playerId: player.id,
                tournamentId: tournament.id
            })

            if (!new_entry) return message.channel.send({ content: `Error: Could not access database.`})
            message.member.roles.add(tourRole)
            message.author.send({ content: `Thanks! I have all the information we need from you. Good luck in the tournament!`})
            return client.channels.cache.get(tournament.channelId).send({ content: `<@${player.id}> is now registered for ${tournament.name}!`})
        } else {
            await entry.update({
                url: deckListUrl,
                deck_name: deckName || deckType,
                deck_type: deckType,
                deck_category: deckCategory
            })
    
            message.author.send({ content: `Thanks! I have your updated deck list for the tournament.`})
            return client.channels.cache.get(tournament.channelId).send({ content: `<@${player.id}> resubmitted their deck list for ${tournament.name}!`})
        }
    }

    //SIGN UP
    if (signupcom.includes(cmd)) {
        if (!isMod(message.member)) return message.channel.send({ content: 'You do not have permission to do that. Please type **!join** instead.'})   
        const member = message.mentions.members.first()
        if (!member) return message.channel.send({ content: `Could not find user in the server.`})
        const player = await Player.findOne({ where: { id: member.user.id }})
        if (!player) return message.channel.send({ content: `${member.user.username} is not in the database.`})
        const tournaments = await Tournament.findAll({ where: { state: 'pending', guildId: mgid }, order: [['createdAt', 'ASC']] })
        const tournament = await selectTournament(message, tournaments, maid)
        const count = await Tournament.count({ where: { state: 'underway', guildId: mgid } })
        if (!tournament && count) return message.channel.send({ content: `Sorry, the tournament already started.`})
        if (!tournament && !count) return message.channel.send({ content: `There is no active tournament.`})
        const entry = await Entry.findOne({ where: { playerId: player.id, tournamentId: tournament.id } })
        
        if (entry) {
            message.channel.send({ content: `Please check your DMs.\n\n(FYI: ${player.name} is already registered for ${tournament.name} ${dandy})`})
        } else {
            message.channel.send({ content: `Please check your DMs.`})
        }

        const dbName = player.duelingBook ? player.duelingBook : await askForDBName(message.member, player, override = true)
        if (!dbName) return
        const deckListUrl = await getDeckList(message.member, player, tournament.name, override = true)
        if (!deckListUrl) return
        const deckName = await getDeckName(message.member, player, override = true)
        const deckType = await getDeckType(member, tournament.name)
        if (!deckType) return
        const deckCategory = getDeckCategory(deckType)
        if (!deckCategory) return

        if (!entry) {                                  
            const { participant } = await postParticipant(tournament, player)
            if (!participant) return message.channel.send({ content: `Error: Could not access tournament: ${tournament.name}`})
            
            const new_entry = await Entry.create({
                pilot: player.name,
                url: deckListUrl,
                deck_name: deckName || deckType,
                deck_type: deckType,
                deck_category: deckCategory,
                participantId: participant.id,
                playerId: player.id,
                tournamentId: tournament.id
            })

            if (!new_entry) return message.channel.send({ content: `Error: Could not access database.`})
            member.roles.add(tourRole)
            message.author.send({ content: `Thanks! I have all the information we need for ${player.name}!`})
            return client.channels.cache.get(tournament.channelId).send({ content: `<@${player.id}> is now registered for ${tournament.name}!`})
        } else {
            await entry.update({
                url: deckListUrl,
                deck_name: deckName || deckType,
                deck_type: deckType,
                deck_category: deckCategory
            })
    
            message.author.send({ content: `Thanks! I have ${player.name}'s updated deck list for the tournament.`})
            return client.channels.cache.get(tournament.channelId).send({ content: `A moderator resubmitted <@${player.id}>'s deck list for ${tournament.name}!`})
        }
    }

    //DROP
    if(dropcom.includes(cmd)) {
        const tournaments = [...await Entry.findAll({ where: { playerId: maid }, include: Tournament })].map((e) => e.tournament).filter((t) => t.guildId === message.guild.id)
        if (!tournaments.length) return message.channel.send({ content: `You are not in an active tournament.`})
        const tournament = await selectTournament(message, tournaments, maid)
        let success = tournament.state === 'pending'
        if (!success) {
            const allMatches = await Match.findAll({ where: { format: 'edison' }, order: [["createdAt", "DESC"]] })
            const last3 = allMatches.slice(-3)
    
            last3.forEach((match) => {
                if (match.winner === maid || match.loser === maid) success = true 
            })

            if (!success) return message.channel.send({ content: `If you played a match, please report the result before dropping. Otherwise ask a Moderator to remove you.`})
        }

        const entry = await Entry.findOne({ where: { playerId: maid }, tournamentId: tournament.id })
        if (!entry) return
        return removeParticipant(message, message.member, entry, tournament, true)
    }

    //REMOVE
    if (cmd.toLowerCase() === `!remove`) {
        if (!isMod(message.member)) return message.channel.send({ content: 'You do not have permission to do that.'})
        const member = message.mentions.members.first()
        const playerId = member && member.user ? member.user.id : null
        if (!playerId) return message.channel.send({ content: `Please specify the player you wish to remove.`})
        const tournaments = [...await Entry.findAll({ where: { playerId: playerId }, include: Tournament })].map((e) => e.tournament).filter((t) => t.guildId === message.guild.id)
        if (!tournaments.length) return message.channel.send({ content: `That user is not in any tournaments.`})
        const tournament = await selectTournament(message, tournaments, maid)
        const entry = await Entry.findOne({ where: { playerId: playerId, tournamentId: tournament.id }, include: Player})
        if (!entry) return message.channel.send({ content: `That user is not in any tournaments.`})

        return removeParticipant(message, member, entry, tournament, false)
    }

    //LEGAL
    if (legalcom.includes(cmd)) {
        const player = await Player.findOne({ where: { id: maid } })
        if (!player) return message.channel.send({ content: `Sorry.`})
        message.channel.send({ content: "Please check your DMs."})
        const issues = await checkDeckList(message.member, player)
        if (!issues) return

        if (issues['illegalCards'].length || issues['forbiddenCards'].length || issues['limitedCards'].length || issues['semiLimitedCards'].length) {
            let response = `I'm sorry, ${player.name}, your deck is not legal for Edison Format. ${dandy}`
            if (issues['illegalCards'].length) response += `\n\nThe following cards are not included in this format:\n${issues['illegalCards'].join('\n')}`
            if (issues['forbiddenCards'].length) response += `\n\nThe following cards are forbidden:\n${issues['forbiddenCards'].join('\n')}`
            if (issues['limitedCards'].length) response += `\n\nThe following cards are limited:\n${issues['limitedCards'].join('\n')}`
            if (issues['semiLimitedCards'].length) response += `\n\nThe following cards are semi-limited:\n${issues['semiLimitedCards'].join('\n')}`
            return message.author.send({ content: response.toString() })
        } else {
            return message.author.send({ content: `Congrats, your Edison Format deck is perfectly legal! ${dandy}`})
        }
    }

    //BANLIST
    if (banscom.includes(cmd)) {
        const forbidden = [...await Status.findAll({ where: { mar10: 'forbidden' }, order: [["name", "ASC"]] })].map((s) => s.name)
        const limited = [...await Status.findAll({ where: { mar10: 'limited' }, order: [["name", "ASC"]] })].map((s) => s.name)
        const semilimited = [...await Status.findAll({ where: { mar10: 'semi-limited' }, order: [["name", "ASC"]] })].map((s) => s.name)

        if (!forbidden.length) forbidden.push(`N/A`)
        if (!limited.length) limited.push(`N/A`)
        if (!semilimited.length) semilimited.push(`N/A`)

        const banlist = [
            `**EDISON FORMAT ${dandy} - FORBIDDEN & LIMITED LIST**`,
            ``,
            `**The following cards are forbidden:**`,
            ...forbidden,
            ``,
            `**The following cards are limited:**`,
            ...limited,
            ``,
            `**The following cards are semi-limited:**`,
            ...semilimited
        ]

        console.log('banlist', banlist)
        console.log('banlist.length', banlist.length)

        for (let i = 0; i < banlist.length; i += 40) message.author.send({ content: banlist.slice(i, i+40).join('\n').toString() })
        return message.channel.send({ content: `I messaged you the Forbidden & Limited list for Edison Format. ${dandy}`})
    }

    //AVATAR
    if (pfpcom.includes(cmd)) {
        const user = message.mentions.users.first() || message.author
        return message.channel.send({ content: user.displayAvatarURL()})
    }

    //DUELINGBOOK NAME
    if (dbcom.includes(cmd)) {
        const member = message.mentions.members.first() || null
        const id = member ? member.user.id : maid
        const player = await Player.findOne({ where: { id } })
        if (!player) return
        if (member && player.duelingBook) return message.channel.send({ content: `${player.name}'s DuelingBook username is: ${player.duelingBook}.`})
        if (member && !player.duelingBook) return message.channel.send({ content: `${player.name} does not have a DuelingBook username in our the database.`})

        if (marr.length > 1) {
            player.duelingBook = marr.slice(1, marr.length).join(' ')
            await player.save()
            return message.channel.send({ content: `Your DuelingBook username has been set to: ${player.duelingBook}.`})
        } else if (player.duelingBook) {
            return message.channel.send({ content: `Your DuelingBook username is: ${player.duelingBook}.`})
        } else {
            return message.channel.send({ content: `You do not have a DuelingBook username in our database. You can type **!db** followed by your username to save it.`})
        }
    }

    //DECK
    if (deckcom.includes(cmd)) {
        const playerId = message.mentions.users.first() ? message.mentions.users.first().id : maid
        const isAuthor = playerId === maid
        if(!isMod(message.member) && !isAuthor) {
            return message.channel.send({ content: `You do not have permission to do that.`})
        } else {
            const player = await Player.findOne({ where: { id: playerId } })
            if (!player) return message.channel.send({ content: `${isAuthor ? 'You are' : 'That player is'} not in the database.`}) 
            const tournaments = await Tournament.findAll({ where: { state: 'pending', guildId: mgid }, order: [['createdAt', 'ASC']] })
            const count = await Tournament.count({ where: { state: 'underway', guildId: mgid } })
            const tournament = await selectTournament(message, tournaments, maid)
            if (!tournament && count) return message.channel.send({ content: `Sorry, the tournament already started.`})
            if (!tournament && !count) return message.channel.send({ content: `There is no active tournament.`})
            const entry = await Entry.findOne({ where: { playerId, tournamentId: tournament.id } })
            if (!entry) return message.channel.send({ content: `${isAuthor ? 'You are' : 'That player is'} not registered for ${tournament.name}.`})
            message.channel.send({ content: `Please check your DMs.`})
            return message.author.send({ content: `${player.name}'s deck link for ${tournament.name} is: ${entry.url}.`})    
        }
    }

    //ROLE
    if (rolecom.includes(cmd)) {
        if (!message.member.roles.cache.some(role => role.id === rankedRole)) {
			message.member.roles.add(rankedRole)
            const membership = await Membership.findOne({ where: { playerId: maid, guildId: mgid } })
            const count = await Role.count({ where: { membershipId: membership.id, roleId: rankedRole } })
            if (!count) {
                await Role.create({ 
                    membershipId: membership.id,
                    roleId: rankedRole,
                    roleName: 'Dueling Book'
                })
            }
            return message.channel.send({ content: `You now have the Dueling Book role.`})
        } else {
            const membership = await Membership.findOne({ where: { playerId: maid, guildId: mgid } })
            const role = await Role.findOne({ where: { membershipId: membership.id, roleId: rankedRole } })
            if (role) {
                await role.destroy()
            } 
            message.member.roles.remove(rankedRole)
            return message.channel.send({ content: `You no longer have the Dueling Book role.`})
        }
    }

    //BOT USER GUIDE
    if (botcom.includes(cmd)) {
        const botEmbed = new Discord.MessageEmbed()
	        .setColor('#38C368')
        	.setTitle('EdisonBot')
	        .setDescription('A Rankings and Tournament Bot for EdisonFormat.com.\n' )
	        .setURL('https://edisonformat.com/')
	        .setAuthor('Jazz#2704', 'https://i.imgur.com/wz5TqmR.png', 'https://edisonformat.com/')
            .setThumbnail('https://i.imgur.com/9lMCJJH.png')
        	.addField('Ranked Play Commands', '\n!stats - (blank or @user) - Post a player’s stats. \n!loss - (@user) - Report a loss to another player. \n!top - (n) - Post the channel’s top rated players (100 max). \n!h2h - (@user + @user) - Post the H2H record between 2 players. \n!role - Add or remove the Ranked Players role. \n!undo - Undo the last loss if you made a mistake. \n')
        	.addField('Format Info Commands', '\n!legal - Privately check if your deck is legal. \n!list - View the Forbidden and Limited list. \n')
        	.addField('Tournament Commands', '\n!join - Register for an upcoming tournament.\n!deck - View the deck list you submitted for a tournament. \n!resubmit - Resubmit your deck list for a tournament. \n!drop - Drop from a tournament. \n!bracket - Post the bracket link(s) for the current tournament(s).')
        	.addField('Server Commands', '\n!db - Set your DuelingBook username. \n!bot - View the RetroBot User Guide. \n!mod - View the Moderator Guide.');

        message.author.send({ embeds: [botEmbed] })
        return message.channel.send({ content: "I messaged you the EdisonBot User Guide."})
    }

    //MOD USER GUIDE
    if (cmd === `!mod`) {
        if (!isMod(message.member)) {
            return message.channel.send({ content: "You do not have permission to do that."})
        } 

        const botEmbed = new Discord.MessageEmbed()
	        .setColor('#38C368')
        	.setTitle('EdisonBot')
	        .setDescription('A Rankings and Tournament Bot for EdisonFormat.com.\n' )
	        .setURL('https://edisonformat.com/')
	        .setAuthor('Jazz#2704', 'https://i.imgur.com/wz5TqmR.png', 'https://edisonformat.com/')
        	.setThumbnail('https://i.imgur.com/9lMCJJH.png')
        	.addField('Mod Ranked Play Commands', '\n!manual - (@winner + @loser) - Manually record a match result. \n!undo - Undo the most recent loss, even if you did not report it.')
            .addField('Mod Tournament Commands', '\n!create - (tournament name) - Create a new tournament. \n!signup - (@user) - Directly add a player to a bracket. \n!deck - (@user) - View the deck list a player submitted for a tournament.\n!noshow - (@user) - Report a no-show. \n!remove - (@user) - Remove a player from a bracket. \n!start - Start a tournament. \n!end (tournament name) - End a tournament. \n!destroy (tournament name) - Destroy a tournament.')
            .addField('Mod Server Commands', '\n!census - Update the information of all players in the database.');

        message.author.send({ embeds: [botEmbed] })
        return message.channel.send({ content: "I messaged you the Mod-Only Guide."})
    }

    //STATS
    if (statscom.includes(cmd)) {
        const playerId = message.mentions.users.first() ? message.mentions.users.first().id : maid	
        const player = await Player.findOne({ where: { id: playerId } })
        if (!player) return message.channel.send({ content: "That user is not in the database."})

        const stats = await Stats.findOne({ 
            where: { 
                playerId, 
                format: 'edison', 
                [Op.or]: [
                    { wins: { [Op.not]: null } }, 
                    { losses: { [Op.not]: null } }, 
                ]
            } 
        })
        
        const all_stats = await Stats.findAll({ 
            where: {
                format: 'edison',
                [Op.or]: [
                    { wins: { [Op.not]: null } }, 
                    { losses: { [Op.not]: null } }, 
                ]
            },
            order: [['elo', 'DESC']] 
        })

        const membersMap = await message.guild.members.fetch()
        const memberIds = [...membersMap.keys()]
        const filtered_stats = all_stats.filter((s) => memberIds.includes(s.playerId))
        const index = filtered_stats.length ? filtered_stats.findIndex((s) => s.playerId === playerId) : null
        const rank = stats ? `#${index + 1} out of ${filtered_stats.length}` : `N/A`
        const elo = stats ? stats.elo.toFixed(2) : `500.00`
        const medal = getMedal(elo, title = true)
        const wins = stats ? stats.wins : 0
        const losses = stats ? stats.losses : 0
        const winrate = wins || losses ? `${(100 * wins / (wins + losses)).toFixed(2)}%` : 'N/A'		
        
        return message.channel.send({ content: 
            `${dandy} --- Edison Stats --- ${dandy}`
            + `\nName: ${player.name}`
            + `\nMedal: ${medal}`
            + `\nRanking: ${rank}`
            + `\nElo Rating: ${elo}`
            + `\nWins: ${wins}, Losses: ${losses}`
            + `\nWin Rate: ${winrate}`
        })
    }

    //RANK
    if (rankcom.includes(cmd)) {
        const x = parseInt(args[0]) || 10
        if (x < 1) return message.channel.send({ content: "Please provide a number greater than 0."})
        if (x > 100 || isNaN(x)) return message.channel.send({ content: "Please provide a number less than or equal to 100."})

        const all_stats = await Stats.findAll({ 
            where: {
                format: 'edison',
                [Op.or]: [
                    { wins: { [Op.not]: null } }, 
                    { losses: { [Op.not]: null } }, 
                ]
            },
            include: Player,
            order: [['elo', 'DESC']] 
        })
        
        const membersMap = await message.guild.members.fetch()
        const memberIds = [...membersMap.keys()]
        const filtered_stats = all_stats.filter((s) => memberIds.includes(s.playerId))
        const top_stats = filtered_stats.slice(0, x)
        if (!top_stats.length) return message.channel.send({ content: `I'm sorry, we don't have any Edison players.`})
        const results = []
        top_stats.length === 1 ? results[0] = `${dandy} --- The Best Edison Player --- ${dandy}`
        : results[0] = `${dandy} --- Top ${top_stats.length} Edison Players --- ${dandy}`

        for (let i = 0; i < top_stats.length; i++) results[i+1] = `${(i+1)}. ${getMedal(top_stats[i].elo)} ${top_stats[i].player.name}`
        for (let i = 0; i < results.length; i += 30) message.channel.send({ content: results.slice(i, i+30).join('\n').toString() })
        return
    }

    //LOSS
    if (losscom.includes(cmd)) {
        const opid = message.mentions.users.first() ? message.mentions.users.first().id : null	
        if (!opid) return message.channel.send({ content: `No player specified.`})
        if (opid === maid) return message.channel.send({ content: `You cannot lose a match to yourself.`})
        if (await isNewUser(opid)) await createPlayer(message.mentions.members.first())
        const winner = message.guild.members.cache.get(opid)
        const winningPlayer = await Player.findOne({ where: { id: opid } })
        const wCount = await Stats.count({ where: { playerId: opid, format: 'edison' } })
        if (!wCount) await Stats.create({ playerId: opid, format: 'edison' })
        const winnerStats = await Stats.findOne({ where: { playerId: opid, format: 'edison' } })
        const losingPlayer = await Player.findOne({ where: { id: maid } })
        const lCount = await Stats.count({ where: { playerId: maid, format: 'edison' } })
        if (!lCount) await Stats.create({ playerId: maid, format: 'edison' })
        const loserStats = await Stats.findOne({ where: { playerId: maid, format: 'edison' } })
        
        if (winner && winner.user.bot) return message.channel.send({ content: `Sorry, Bots do not play Edison Format... *yet*.`})
        if (opid.length < 17 || opid.length > 18) return message.channel.send({ content: `To report a loss, type **!loss @opponent**.`})
        if (!losingPlayer|| !loserStats) return message.channel.send({ content: `You are not in the database.`})
        if (!winningPlayer || !winnerStats) return message.channel.send({ content: `That user is not in the database.`})
 
        const loserHasTourRole = isTourPlayer(message.member)
        const winnerHasTourRole = isTourPlayer(winner)
        const activeTournament = await Tournament.count({ where: { state: 'underway', guildId: mgid } }) 
        let isTournamentMatch
        let winningEntry
        let losingEntry
        let tournament

        if (loserHasTourRole && winnerHasTourRole && activeTournament) {
            const loserEntries = await Entry.findAll({ where: { playerId: losingPlayer.id }, include: Tournament })
            const winnerEntries = await Entry.findAll({ where: { playerId: winningPlayer.id }, include: Tournament })
            if (loserEntries.length && winnerEntries.length) {
                const loser_tournament_ids = []
                const winner_tournament_ids = []
                const common_tournament_ids = []
                const tournaments = []

                for (let i = 0; i < loserEntries.length; i++) {
                    const entry = loserEntries[i]
                    loser_tournament_ids.push(entry.tournament.id)
                }

                for (let i = 0; i < winnerEntries.length; i++) {
                    const entry = winnerEntries[i]
                    winner_tournament_ids.push(entry.tournament.id)
                }

                for (let i = 0; i < loser_tournament_ids.length; i++) {
                    const tournament_id = loser_tournament_ids[i]
                    if (winner_tournament_ids.includes(tournament_id)) {
                        common_tournament_ids.push(tournament_id)
                    }
                }

                if (common_tournament_ids.length) {
                    for (let i = 0; i < common_tournament_ids.length; i++) {
                        const id = common_tournament_ids[i]
                        tournament = await Tournament.findOne({ where: { id: id, guildId: mgid }})
                        losingEntry = await Entry.findOne({ where: { playerId: losingPlayer.id, tournamentId: tournament.id } })
                        winningEntry = await Entry.findOne({ where: { playerId: winningPlayer.id, tournamentId: tournament.id } })
                        if (!losingEntry || !winningEntry) continue
                        const matches = await getMatches(tournament.id)
                        if (!matches) continue
                        for (let i = 0; i < matches.length; i++) {
                            const match = matches[i].match
                            if (match.state !== 'open') continue
                            if (checkPairing(match, losingEntry.participantId, winningEntry.participantId)) {
                                tournaments.push(tournament)
                                break
                            }
                        }
                    }
                }
    
                if (tournaments.length) {
                    const tournament = await selectTournament(message, tournaments, message.member.user.id)
                    if (tournament) {
                        isTournamentMatch = true
                        if (tournament.state === 'pending') return message.channel.send({ content: `Sorry, ${tournament.name} has not started yet.`})
                        if (tournament.state !== 'underway') return message.channel.send({ content: `Sorry, ${tournament.name} is not underway.`})
                        const success = await processMatchResult(message, winningPlayer, losingPlayer, tournament)
                        if (!success) return
                    } else {
                        return
                    }
                }
            }
        }
           
        const origEloWinner = winnerStats.elo || 500.00
        const origEloLoser = loserStats.elo || 500.00
        const delta = 20 * (1 - (1 - 1 / ( 1 + (Math.pow(10, ((origEloWinner - origEloLoser) / 400))))))
        
        winnerStats.elo = origEloWinner + delta
        winnerStats.backupElo = origEloWinner
        winnerStats.wins++
        await winnerStats.save()

        loserStats.elo = origEloLoser - delta
        loserStats.backupElo = origEloLoser
        loserStats.losses++
        await loserStats.save()

        const match = await Match.create({
            winnerId: winningPlayer.id,
            winner_name: winningPlayer.name,
            loserId: losingPlayer.id,
            loser_name: losingPlayer.name,
            tournament: isTournamentMatch,
            format: 'edison',
            delta: delta
        })

        if (isTournamentMatch && winningEntry && losingEntry && tournament && match) {
            await Matchup.create({
                winning_deck_name: winningEntry.deck_name,
                winning_deck_type: winningEntry.deck_type,
                winning_deck_category: winningEntry.deck_category,
                losing_deck_name: losingEntry.deck_name,
                losing_deck_type: losingEntry.deck_type,
                losing_deck_category: losingEntry.deck_category,
                matchId: match.id,
                format: 'edison',
                tournamentId: tournament.id
            })
        }

        return message.channel.send({ content: `${losingPlayer.name}, your Edison Format ${isTournamentMatch ? 'Tournament ' : ''}loss to ${winningPlayer.name} has been recorded.`})
    }

    //MANUAL
    if (manualcom.includes(cmd)) {
        if (!isMod(message.member)) return message.channel.send({ content: `You do not have permission to do that.`})

        const usersMap = message.mentions.users
        const userIds = [...usersMap.keys()]	
        const winnerId = message.mentions.users.first() ? message.mentions.users.first().id : args.length > 0 ? args[0]	: null
        const loserId = userIds.length > 1 ? userIds[1] : args.length > 1 ? args[1] : null	
        if (!winnerId || !loserId) return message.channel.send({ content: `Please specify 2 players.`})
        if (winnerId === loserId) return message.channel.send({ content: `Please specify 2 different players.`})

        const winner = message.guild.members.cache.get(winnerId)
        const loser = message.guild.members.cache.get(loserId)
        if ((winner && winner.user.bot) ||  (loser && loser.user.bot)  ) return message.channel.send({ content: `Sorry, Bots do not play Edison Format... *yet*.`})

        if (winner && await isNewUser(winnerId)) await createPlayer(winner)
        if (loser && await isNewUser(loserId)) await createPlayer(loser)
        
        const winningPlayer = await Player.findOne({ where: { id: winnerId } })
        const wCount = await Stats.count({ where: { playerId: winnerId, format: 'edison' } })
        if (!wCount) await Stats.create({ playerId: winnerId, format: 'edison' })
        const winnerStats = await Stats.findOne({ where: { playerId: winnerId, format: 'edison' } })
        const losingPlayer = await Player.findOne({ where: { id: loserId } })
        const lCount = await Stats.count({ where: { playerId: loserId, format: 'edison' } })
        if (!lCount) await Stats.create({ playerId: loserId, format: 'edison' })
        const loserStats = await Stats.findOne({ where: { playerId: loserId, format: 'edison' } })

        if (!losingPlayer || !loserStats) return message.channel.send({ content: `Sorry, <@${loserId}> is not in the database.`})
        if (!winningPlayer || !winnerStats) return message.channel.send({ content: `Sorry, <@${winnerId}> is not in the database.`})

        const loserHasTourRole = await isTourPlayer(loser)
        const winnerHasTourRole = await isTourPlayer(winner)
        const activeTournament = await Tournament.count({ where: { state: 'underway', guildId: mgid } }) 
        let isTournamentMatch
        let winningEntry
        let losingEntry
        let tournament

        if (loserHasTourRole && winnerHasTourRole && activeTournament) {
            const loserEntries = await Entry.findAll({ where: { playerId: losingPlayer.id }, include: Tournament })
            const winnerEntries = await Entry.findAll({ where: { playerId: winningPlayer.id }, include: Tournament })
            if (loserEntries.length && winnerEntries.length) {
                const loser_tournament_ids = []
                const winner_tournament_ids = []
                const common_tournament_ids = []
                const tournaments = []

                for (let i = 0; i < loserEntries.length; i++) {
                    const entry = loserEntries[i]
                    loser_tournament_ids.push(entry.tournament.id)
                }

                for (let i = 0; i < winnerEntries.length; i++) {
                    const entry = winnerEntries[i]
                    winner_tournament_ids.push(entry.tournament.id)
                }

                for (let i = 0; i < loser_tournament_ids.length; i++) {
                    const tournament_id = loser_tournament_ids[i]
                    if (winner_tournament_ids.includes(tournament_id)) {
                        common_tournament_ids.push(tournament_id)
                    }
                }
                
                if (common_tournament_ids.length) {
                    for (let i = 0; i < common_tournament_ids.length; i++) {
                        const id = common_tournament_ids[i]
                        tournament = await Tournament.findOne({ where: { id: id, guildId: mgid }})
                        losingEntry = await Entry.findOne({ where: { playerId: losingPlayer.id, tournamentId: tournament.id } })
                        winningEntry = await Entry.findOne({ where: { playerId: winningPlayer.id, tournamentId: tournament.id } })
                        if (!losingEntry || !winningEntry) continue
                        const matches = await getMatches(tournament.id)
                        if (!matches) continue
                        for (let i = 0; i < matches.length; i++) {
                            const match = matches[i].match
                            if (match.state !== 'open') continue
                            if (checkPairing(match, losingEntry.participantId, winningEntry.participantId)) {
                                tournaments.push(tournament)
                                break
                            }
                        }
                    }
                }
                    
                if (tournaments.length) {
                    const tournament = await selectTournament(message, tournaments, message.member.user.id)
                    if (tournament) {
                        isTournamentMatch = true
                        if (tournament.state === 'pending') return message.channel.send({ content: `Sorry, ${tournament.name} has not started yet.`})
                        if (tournament.state !== 'underway') return message.channel.send({ content: `Sorry, ${tournament.name} is not underway.`})
                        const success = await processMatchResult(message, winningPlayer, losingPlayer, tournament)
                        if (!success) return
                    } else {
                        return
                    }
                }
            }
        }
            
        const origEloWinner = winnerStats.elo || 500.00
        const origEloLoser = loserStats.elo || 500.00
        const delta = 20 * (1 - (1 - 1 / ( 1 + (Math.pow(10, ((origEloWinner - origEloLoser) / 400))))))
        
        winnerStats.elo = origEloWinner + delta
        winnerStats.backupElo = origEloWinner
        winnerStats.wins++
        await winnerStats.save()

        loserStats.elo = origEloLoser - delta
        loserStats.backupElo = origEloLoser
        loserStats.losses++
        await loserStats.save()

        const match = await Match.create({
            winner_name: winningPlayer.name,
            winnerId: winningPlayer.id,
            loser_name: losingPlayer.name,
            loserId: losingPlayer.id,
            tournament: isTournamentMatch,
            format: 'edison',
            delta: delta
        })

        if (isTournamentMatch && winningEntry && losingEntry && tournament && match) {
            await Matchup.create({
                winning_deck_name: winningEntry.deck_name,
                winning_deck_type: winningEntry.deck_type,
                winning_deck_category: winningEntry.deck_category,
                losing_deck_name: losingEntry.deck_name,
                losing_deck_type: losingEntry.deck_type,
                losing_deck_category: losingEntry.deck_category,
                matchId: match.id,
                format: 'edison',
                tournamentId: tournament.id
            })
        }

        return message.channel.send({ content: `A manual Edison Format ${isTournamentMatch ? 'Tournament ' : ''}loss by ${losingPlayer.name} to ${winningPlayer.name} has been recorded.`})		
    }

    //NO SHOW
    if (noshowcom.includes(cmd)) {
        if (!isMod(message.member)) return message.channel.send({ content: `You do not have permission to do that.`})

        const noShowId = message.mentions.users.first() ? message.mentions.users.first().id : args.length > 0 ? args[0]	: null
        if (!noShowId) return message.channel.send({ content: "Please specify a player."})
        const noshow = message.guild.members.cache.get(noShowId)
        if ((noshow && noshow.user.bot)) return message.channel.send({ content: `Sorry, Bots do not play Edison Format... *yet*.`})
        if (noshow && await isNewUser(noShowId)) await createPlayer(noshow)
        const noShowPlayer = await Player.findOne({ where: { id: noShowId } })
        if (!noShowPlayer) return message.channel.send({ content: `Sorry, <@${noShowId}> is not in the database.`})
        const tournaments = [...await Entry.findAll({ where: { playerId: noShowId }, include: Tournament })].map((e) => e.tournament).filter((t) => t.guildId === message.guild.id)
        if (!tournaments.length || !noshow.roles.cache.some(role => role.id === tourRole)) return message.channel.send({ content: `Sorry, ${noShowPlayer.name} is not any tournaments.`})
     
        const tournament = await selectTournament(message, tournaments, maid)
        if (!tournament) return
        if (tournament.state === 'pending') return message.channel.send({ content: `Sorry, ${tournament.name} has not started yet.`})
        if (tournament.state !== 'underway') return message.channel.send({ content: `Sorry, ${tournament.name} is not underway.`})
        
        const noShowEntry = await Entry.findOne({ where: { playerId: noShowId, tournamentId: tournament.id } })
        if (!noShowEntry) return message.channel.send({ content: `Sorry I could not find that player's tournament entry in the database.`})

        const matchesArr = await getMatches(tournament.id)
        let winnerParticipantId = false
        for (let i = 0; i < matchesArr.length; i++) {
            const match = matchesArr[i].match
            if (match.state !== 'open') continue
            winnerParticipantId = findNoShowOpponent(match, noShowEntry.participantId)
            if (winnerParticipantId) break
        }

        const winningEntry = await Entry.findOne({ where: { participantId: winnerParticipantId, tournamentId: tournament.id }, include: Player })
        if (!winningEntry) return message.channel.send({ content: `Error: could not find opponent.`})

        const success = await processMatchResult(message, winningEntry.player, noShowPlayer, tournament, true)
        if (!success) return

        return message.channel.send({ content: `${noShowPlayer.name}, your Edison Format Tournament loss to <@${winningEntry.playerId}> has been recorded as a no-show.`})
    }

    //H2H
    if (h2hcom.includes(cmd)) {
        const usersMap = message.mentions.users
        const userIds = [...usersMap.keys()]
        const player1Id = message.mentions.users.first() ? message.mentions.users.first().id : null	
        const player2Id = userIds.length > 1 ? userIds[1] : maid	

        if (!player1Id) return message.channel.send({ content: "Please specify at least 1 other player."})
        if (player1Id === player2Id) return message.channel.send({ content: `Please specify 2 different players.`})

        const player1 = await Player.findOne({ where: { id: player1Id } })
        const player2 = await Player.findOne({ where: { id: player2Id } })
        
        if (!player1 && player2Id === maid) return message.channel.send({ content: `That user is not in the database.`})
        if (!player1 && player2Id !== maid) return message.channel.send({ content: `The first user is not in the database.`})
        if (!player2 && player2Id === maid) return message.channel.send({ content: `You are not in the database.`})
        if (!player2 && player2Id !== maid) return message.channel.send({ content: `The second user is not in the database.`})

        const p1Wins = await Match.count({ where: { winnerId: player1Id, loserId: player2Id, format: 'edison' } })
        const p2Wins = await Match.count({ where: { winnerId: player2Id, loserId: player1Id, format: 'edison' } })
        
        return message.channel.send({ content: 
            `${dandy} --- H2H Edison Results --- ${dandy}`+
            `\n${player1.name} has won ${p1Wins}x`+
            `\n${player2.name} has won ${p2Wins}x`
        })
    }

    //UNDO
    if (undocom.includes(cmd)) {
        const allMatches = await Match.findAll({ where: { format: 'edison' } })
        const lastMatch = allMatches.slice(-1)[0]
        const winnerId = lastMatch.winnerId
        const loserId = lastMatch.loserId
        const winningPlayer = await Player.findOne({ where: { id: winnerId } })
        const winnerStats = await Stats.findOne({ where: { playerId: winnerId, format: 'edison' } })
        const losingPlayer = await Player.findOne({ where: { id: loserId } })
        const loserStats = await Stats.findOne({ where: { playerId: loserId, format: 'edison' } })
        
        const prompt = (isMod(message.member) ? '' : ' Please get a Moderator to help you.')
        if (maid !== loserId && !isMod(message.member)) return message.channel.send({ content: `You did not participate in the last recorded match.${prompt}`})

        if (!winnerStats.backupElo && maid !== loserId) return message.channel.send({ content: `${winningPlayer.name} has no backup stats.${prompt}`})
        if (!winnerStats.backupElo && maid === loserId) return message.channel.send({ content: `Your last opponent, ${winningPlayer.name}, has no backup stats.${prompt}`})
        if (!loserStats.backupElo && maid !== loserId) return message.channel.send({ content: `${losingPlayer.name} has no backup stats.${prompt}`})
        if (!loserStats.backupElo && maid === loserId) return message.channel.send({ content: `You have no backup stats.${prompt}`})

        winnerStats.elo = winnerStats.backupElo
        winnerStats.backupElo = null
        winnerStats.wins--
        await winnerStats.save()

        loserStats.elo = loserStats.backupElo
        loserStats.backupElo = null
        loserStats.losses--
        await loserStats.save()

        await lastMatch.destroy()
        return message.channel.send({ content: `The last Edison Format match in which ${winningPlayer.name} defeated ${losingPlayer.name} has been erased.`})
    }

    //CENSUS
    // Use this command to update every player's username and tag to match their Discord account.
    // It also creates new players if they are not in the database (i.e. they joined while bot was down).
    if (cmd === `!census`) { 
        if (!isMod(message.member)) return message.channel.send({ content: "You do not have permission to do that."})
        const members_map = await message.guild.members.fetch()
        const members = [...members_map.values()]
        const rolesMap = message.guild.roles.cache
        const roles = [...rolesMap.values()].reduce((a, v) => ({ ...a, [v.id]: v.name}), {})     
        let updateCount = 0
        let createCount = 0
        let memberCount = 0
        let roleCount = 0

        for (let i = 0; i < members.length; i++) {
            const member = members[i]
            if (member.user.bot) continue
            const player = await Player.findOne({ where: { id: member.user.id } })
            if (player && ( player.name !== member.user.username || player.tag !== member.user.tag )) {
                updateCount++
                await player.update({
                    name: member.user.username,
                    tag: member.user.tag
                })
            } else if (!player && !member.user.bot) {
                createCount++
                await createPlayer(member)
            }

            const membership = await Membership.count({ where: { playerId: member.user.id } })
            if (!membership) {
                memberCount++
                await createMembership(message.guild, member)
            }

            for (let j = 0; j < member._roles.length; j ++) {
                const roleId = member._roles[j]
                const membership = await Membership.findOne({ where: { playerId: member.user.id, guildId: mgid } })
                if (!membership) break
                const count = await Role.count({ where: { membershipId: membership.id, roleId: roleId }})
                if (!count) {
                    await Role.create({
                        membershipId: membership.id,
                        roleId: roleId,
                        roleName: roles[roleId]
                    })
                    roleCount++
                }
            }
        }

        return message.channel.send({ content: 
            `You added the following to the database:` +
            `\n- ${createCount} new ${createCount === 1 ? 'player' : 'players'}` +
            `\n- ${memberCount} new ${memberCount === 1 ? 'member' : 'members'}` +
            `\n- ${updateCount} updated ${updateCount === 1 ? 'player' : 'players'}` +
            `\n- ${roleCount} updated ${roleCount === 1 ? 'role' : 'roles'}`
        })
    }
})