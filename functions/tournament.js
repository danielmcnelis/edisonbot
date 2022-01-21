
//TOURNAMENT FUNCTIONS

//MODULE IMPORTS
const axios = require('axios')
const fs = require('fs')

//DATABASE IMPORTS
const { Entry, Player, Stats }  = require('../db/index.js')

//FUNCTION IMPORTS
const { getDeckType, saveYDK } = require('./deck.js')
const { capitalize, convertArrayToObject, getDeckCategory, shuffleArray } = require('./utility.js')

// STATIC IMPORTS
const { yescom } = require('../static/commands.json')
const { dandy } = require('../static/emojis.json')
const { tourRole } = require('../static/roles.json')
const { challongeAPIKey } = require('../secrets.json')

////// TOURNAMENT REGISTRATION FUNCTIONS ///////

//ASK FOR DB NAME
const askForDBName = async (member, player, override = false, error = false, attempt = 1) => {
    const filter = m => m.author.id === member.user.id
    const pronoun = override ? `${player.name}'s` : 'your'
    const greeting = override ? '' : 'Hi! '
    const prompt = error ? `I think you're getting ahead of yourself. First, I need ${pronoun} DuelingBook name.`
    : `${greeting}This appears to be ${player.name}'s first tournament in our system. Can you please provide ${pronoun} DuelingBook name?`
	const message = await member.user.send({ content: `${prompt}` }).catch((err) => console.log(err))
    if (!message || !message.channel) return false
    return await message.channel.awaitMessages({
        filter,
		max: 1,
        time: 15000
    }).then(async (collected) => {
        const dbName = collected.first().content
        if (dbName.includes("duelingbook.com/deck") || dbName.includes("imgur.com")) {
            if (attempt >= 3) {
                member.user.send({ content: `Sorry, time's up. Go back to the server and try again.`})
                return false
            } else {
                return askForDBName(member, player, override, true, attempt++)
            }
        } else {
            await player.update({
                duelingBook: dbName
            })
            member.user.send({ content: `Thanks! I saved ${pronoun} DuelingBook name as: ${dbName}. If that's wrong, go back to the server and type **!db name**.`})
            return dbName
        }
    }).catch((err) => {
        console.log(err)
        member.user.send({ content: `Sorry, time's up. Go back to the server and try again.`})
        return false
    })
}

//GET DECK LIST TOURNAMENT
const getDeckList = async (member, player, tournamentName = 'other', override = false) => {            
    const filter = m => m.author.id === member.user.id
    const pronoun = override ? `${player.name}'s` : 'your'
    const message = await member.user.send({ content: `Please provide a duelingbook.com/deck link for ${pronoun} tournament deck.`}).catch((err) => console.log(err))
    if (!message || !message.channel) return false
    return await message.channel.awaitMessages({
        filter,
        max: 1,
        time: 30000
    }).then(async (collected) => {
        const url = collected.first().content
        if (url.includes("www.duelingbook.com/deck")) {		
            member.send({ content: 'Thanks. Please wait while I download the .YDK file. This can take up to 30 seconds.'})
            const issues = await saveYDK(player, url, tournamentName)

            if (override) {
                member.send({ content: `Thanks, ${member.user.username}, I saved a copy of ${pronoun} deck. ${dandy}`})
                return url
            } else if (issues['illegalCards'].length || issues['forbiddenCards'].length || issues['limitedCards'].length || issues['semiLimitedCards'].length) {
                let response = `I'm sorry, ${member.user.username}, ${pronoun} deck is not legal. ${dandy}`
                if (issues['illegalCards'].length) response += `\n\nThe following cards are not in this game:\n${issues['illegalCards'].join('\n')}`
                if (issues['forbiddenCards'].length) response += `\n\nThe following cards are forbidden:\n${issues['forbiddenCards'].join('\n')}`
                if (issues['limitedCards'].length) response += `\n\nThe following cards are limited:\n${issues['limitedCards'].join('\n')}`
                if (issues['semiLimitedCards'].length) response += `\n\nThe following cards are semi-limited:\n${issues['semiLimitedCards'].join('\n')}`
                response += `\n\nPlease edit ${pronoun} deck and try again once it's legal. If you believe this message is in error, contact the Tournament Organizer.`
            
                member.send({ content: response.toString() })
                return false
            } else if (issues['unrecognizedCards'].length) {
                let response = `I'm sorry, ${member.user.username}, the following card IDs were not found in our database:\n${issues['unrecognizedCards'].join('\n')}`
                response += `\n\nThese cards are either alternate artwork, new to the TCG, OCG only, or incorrect in our database. Please contact the Tournament Organizer or the Admin if you can't resolve this.`
                
                member.send({ content: response.toString() })
                return false
             } else {
                member.send({ content: `Thanks, ${member.user.username}, ${pronoun} deck is perfectly legal. ${dandy}`})
                return url
            }
        } else {
            member.send({ content: "Sorry, I only accept duelingbook.com/deck links."})
            return false
        }
    }).catch((err) => {
        console.log(err)
        member.send({ content: `Sorry, time's up. Go back to the server and try again.`})
        return false
    })
}

//GET DECK NAME
const getDeckName = async (member, player, override = false) => {
    const pronoun = override ? `${player.name}'s` : 'your'
    const filter = m => m.author.id === member.user.id
	const message = await member.send({ content: `Please provide the common name for ${pronoun} deck (i.e. Quickdraw Plant, Blackwing, Dragon Turbo, etc.).`}).catch((err) => console.log(err))
    if (!message || !message.channel) return false
    return await message.channel.awaitMessages({
        filter,
		max: 1,
        time: 15000
    }).then(async collected => {
        const response = collected.first().content.toLowerCase()
        return response
    }).catch(err => {    
        console.log(err)
        member.send({ content: `Sorry, time's up.`})
        return false
    })
}

// SELECT TOURNAMENT
const selectTournament = async (message, tournaments, playerId) => {
    if (tournaments.length === 0) return false
    if (tournaments.length === 1) return tournaments[0]
    const options = tournaments.map((tournament, index) => `(${index + 1}) ${tournament.name}`)
    const filter = m => m.author.id === playerId
    message.channel.send({ content: `Please select a tournament:\n${options.join('\n').toString() }`})
    return await message.channel.awaitMessages({
        filter,
        max: 1,
        time: 15000
    }).then(collected => {
        const num = parseInt(collected.first().content.match(/\d+/))
        if (!num || !tournaments[num - 1]) {
            message.channel.send({ content: `Sorry, ${collected.first().content} is not a valid option.`})
            return null
        }
        else return tournaments[num - 1]
    }).catch(err => {
        console.log(err)
        return null
    })
}


////// TOURNAMENT HOST FUNCTIONS ///////

// CREATE SHEET DATA
const createSheetData = async (tournament) => {
    const entries = await Entry.findAll({ where: { tournamentId: tournament.id}, include: Player })
    const typeData = {}
    const catData = {}
    const sheet1Data = [['Player', 'Deck', 'Type', 'Link']]
    const sheet2DataA = [['Deck', 'Entries', 'Percent']]
    const sheet2DataB = [[], ['Category', 'Entries', 'Percent']]
    const file_names = fs.readdirSync(`./decks/${tournament.name}/`)

    if (!entries.length) {
        for (let i = 0; i < file_names.length; i++) {
            const file_name = file_names[i]
            const tag = file_name.slice(0, -4)
            console.log('tag', tag)
            const member = { user: { tag }}
            const deckType = await getDeckType(member, tournament.name)
            if (!deckType) return
            const deckCategory = getDeckCategory(deckType)
            if (!deckCategory) return
            
            typeData[deckType] ? typeData[deckType]++ : typeData[deckType] = 1
            catData[deckCategory] ? catData[deckCategory]++ : catData[deckCategory] = 1
            sheet1Data.push([tag.slice(0, -5).replace("_", " "), 'N/A', deckType, 'N/A'])
        }
    } else {
        entries.forEach((e) => {
            typeData[e.deck_type] ? typeData[e.deck_type]++ : typeData[e.deck_type] = 1
            catData[e.deck_category] ? catData[e.deck_category]++ : catData[e.deck_category] = 1
            sheet1Data.push([e.pilot, e.deck_name, e.deck_type, e.url])
        })
    }
    
    let typeDataArr = Object.entries(typeData).sort((b, a) => b[0].localeCompare(a[0]))
    let catDataArr = Object.entries(catData).sort((b, a) => b[0].localeCompare(a[0]))

    let typeDataArr2 = typeDataArr.map((e) => [e[0], e[1], `${(e[1], e[1] / (entries.length || file_names.length) * 100).toFixed(2)}%`])
    let catDataArr2 = catDataArr.map((e) =>[capitalize(e[0]), e[1], `${(e[1], e[1] / (entries.length || file_names.length) * 100).toFixed(2)}%`])

    const sheet2Data = [...sheet2DataA, ...typeDataArr2, ...sheet2DataB, ...catDataArr2]

    const data = {
        sheet1Data,
        sheet2Data
    }

    return data
}

// GET TOURNAMENT TYPE
const getTournamentType = async (message) => {
    const filter = m => m.author.id === message.author.id
	message.channel.send({ content: `What type of tournament is this?\n(1) Single Elimination\n(2) Double Elimination\n(3) Swiss\n(4) Round Robin`})
	return await message.channel.awaitMessages({
        filter,
		max: 1,
		time: 15000
	}).then(collected => {
		const response = collected.first().content.toLowerCase()
        const tournamentType = response.includes(1) || response.startsWith('single') ? 'single elimination' :
            response.includes(2) || response.startsWith('double') ? 'double elimination' :
            response.includes(3) || response.startsWith('swiss') ? 'swiss' :
            response.includes(4) || response.startsWith('round') ? 'round robin' :
            false

        console.log('tournamentType', tournamentType)

        return tournamentType 
	}).catch(err => {
		console.log(err)
        message.channel.send({ content: `Sorry, time's up.`})
	})
}

//REMOVE PARTICIPANT
const removeParticipant = async (message, member, entry, tournament, drop = false) => {    
    try {
        const success = await axios({
            method: 'delete',
            url: `https://Chappell:${challongeAPIKey}@api.challonge.com/v1/tournaments/${tournament.id}/participants/${entry.participantId}.json`,
        })

        if (success) {
            await entry.destroy()
            member.roles.remove(tourRole)
        
            if (drop) {
                return message.channel.send({ content: `I removed you from the tournament. Better luck next time!`})
            } else {
                return message.channel.send({ content: `${member.user.username} has been removed from the tournament.`})
            }
        } else if (!success && drop) {
            return message.channel.send({ content: `Hmm... I don't see you in the participants list.`})
        } else if (!success && !drop) {
            return message.channel.send({ content: `I could not find ${member.user.username} in the participants list.`})
        }
    } catch (err) {
        console.log(err)
        if (drop) {
            return message.channel.send({ content: `Hmm... I don't see you in the participants list.`})
        } else {
            return message.channel.send({ content: `I could not find ${member.user.username} in the participants list.`})
        }
    }   
}

//SEED
const seed = async (message, tournament) => {
    const entries = await Entry.findAll({ where: { tournamentId: tournament.id } })    
    const expEntries = []
    const newbieEntries = []

    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]
        const playerId = entry.playerId
        const stats = await Stats.findOne({ where: { format: 'edison', playerId } })
        if (stats) {
            expEntries.push([entry.participantId, entry.pilot, stats.elo])
        } else {
            newbieEntries.push([entry.participantId, entry.pilot, null])
        }
    }

    const seeds = [...expEntries.sort((a, b) => b[2] - a[2]), ...shuffleArray(newbieEntries)]    
    let count = 0
    const results = []
    for (let i = 0; i < seeds.length; i++) {
        const participantId = seeds[i][0]
        const name = seeds[i][1]

        try {
            await axios({
                method: 'put',
                url: `https://Chappell:${challongeAPIKey}@api.challonge.com/v1/tournaments/${tournament.id}/participants/${participantId}.json`,
                data: {
                    participant: {
                        seed: i+1
                    }
                }
            })

            results.push(`${name} is now the ${i+1} seed.`)
            count++
        } catch (err) {
            console.log(err)
        }   
    }

    for (let i = 0; i < results.length; i += 30) message.channel.send({ content: results.slice(i, i + 30).join('\n').toString()})
    return count === seeds.length
}


////// TOURNAMENT MANAGEMENT FUNCTIONS ///////

//CHECK CHALLONGE PAIRING
const checkPairing = (match, p1, p2) => (match.player1_id === p1 && match.player2_id === p2) || (match.player1_id === p2 && match.player2_id === p1)

//FIND NEXT MATCH
const findNextMatch = (matchesArr, matchId, participantId) => {
    for (let i = 0; i < matchesArr.length; i++) {
        const match = matchesArr[i].match
        if (match.state === 'complete') continue
        if (match.prerequisite_match_ids_csv.includes(matchId) && (match.player1_id === participantId || match.player2_id === participantId)) {
            return match.id
        }
    }

    return false
}

//FIND NEXT OPPONENT
const findNextOpponent = async (tournamentId, matchesArr, matchId, participantId) => {
    for (let i = 0; i < matchesArr.length; i++) {
        const match = matchesArr[i].match
        if (match.id === matchId) {
            const player1_id = match.player1_id
            const player2_id = match.player2_id
            if (player1_id === participantId) {
                if (!player2_id) return false
                const opponentEntry = await Entry.findOne({
                    where: {
                        tournamentId: tournamentId,
                        participantId: player2_id
                    },
                    include: Player
                })

                return opponentEntry
            } else if (player2_id === participantId) {
                if (!player1_id) return false
                const opponentEntry = await Entry.findOne({
                    where: {
                        tournamentId: tournamentId,
                        participantId: player1_id
                    },
                    include: Player
                }) 

                return opponentEntry
            }
        }
    }

    return false
}

//FIND NO SHOW OPPONENT
const findNoShowOpponent = (match, noShowParticipantId) => {
    if (match.player1_id === noShowParticipantId) return match.player2_id
    if (match.player2_id === noShowParticipantId) return match.player1_id
    else return false
}

//FIND OTHER PRE REQ MATCH
const findOtherPreReqMatch = (matchesArr, nextMatchId, completedMatchId) => {
    for (let i = 0; i < matchesArr.length; i++) {
        const match = matchesArr[i].match
        if (match.id === nextMatchId) {
            const pre_reqs = match.prerequisite_match_ids_csv.split(",").map((e) => parseInt(e))
            if (pre_reqs[0] === completedMatchId) {
                const pairing = getPairing(matchesArr, pre_reqs[1])
                return pairing
            } else if (pre_reqs[1] === completedMatchId) {
                const pairing = getPairing(matchesArr, pre_reqs[0])
                return pairing
            } 
            else return false
        }
    }

    return false
}

//GET MATCHES
const getMatches = async (tournamentId) => {
    try {
        const { data } = await axios.get(
            `https://Chappell:${challongeAPIKey}@api.challonge.com/v1/tournaments/${tournamentId}/matches.json`
        )
        return data
    } catch (err) {
        console.log(err)
    }
}

//GET PAIRING
const getPairing = (matchesArr, matchId) => {
    let p1 = null
    let p2 = null

    for (let i = 0; i < matchesArr.length; i++) {
        const match = matchesArr[i].match
        if (match.id === matchId) {
            p1 = match.player1_id
            p2 = match.player2_id
            break
        }
    }

    const pairing = {
        p1,
        p2
    }

    return pairing
}

//POST PARTICIPANT
const postParticipant = async (tournament, player) => {
    try {
        const { data } = await axios({
            method: 'post',
            url: `https://Chappell:${challongeAPIKey}@api.challonge.com/v1/tournaments/${tournament.id}/participants.json`,
            data: {
                participant: {
                    name: player.name
                }
            }
        })
        return data
    } catch (err) {
        console.log(err)
    }   
}

//PROCESS MATCH RESULT
const processMatchResult = async (message, winningPlayer, losingPlayer, tournament, noshow = false) => {
    const losingEntry = await Entry.findOne({ where: { playerId: losingPlayer.id, tournamentId: tournament.id } })
    const winningEntry = await Entry.findOne({ where: { playerId: winningPlayer.id, tournamentId: tournament.id } })
    if (!losingEntry || !winningEntry) {
        message.channel.send({ content: `Sorry I could not find your tournament in the database.`})
        return false
    } 

    const matchesArr = await getMatches(tournament.id)
    let matchId = false
    let scores = false
    for (let i = 0; i < matchesArr.length; i++) {
        const match = matchesArr[i].match
        if (match.state !== 'open') continue
        if (checkPairing(match, losingEntry.participantId, winningEntry.participantId)) {
            matchId = match.id    
            scores = noshow ? "0-0" : match.player1_id === winningEntry.participantId ? "1-0" : "0-1"
            break
        }
    }

    const success = await axios({
        method: 'put',
        url: `https://Chappell:${challongeAPIKey}@api.challonge.com/v1/tournaments/${tournament.id}/matches/${matchId}.json`,
        data: {
            match: {
                winner_id: winningEntry.participantId,
                scores_csv: scores
            }
        }
    })
     
    if (!success) {
        message.channel.send({ content: `Error: could not update bracket for ${tournament.name}.`})
        return false
    } 
 
    losingEntry.losses++
    await losingEntry.save()
    
    winningEntry.wins++
    await winningEntry.save()
    const updatedMatchesArr = await getMatches(tournament.id)
    const winnerNextMatch = findNextMatch(updatedMatchesArr, matchId, winningEntry.participantId)
    const winnerNextOpponent = winnerNextMatch ? await findNextOpponent(tournament.id, updatedMatchesArr, winnerNextMatch, winningEntry.participantId) : null
    const winnerMatchWaitingOn = winnerNextOpponent ? null : findOtherPreReqMatch(updatedMatchesArr, winnerNextMatch, matchId) 
    const winnerWaitingOnP1 = winnerMatchWaitingOn && winnerMatchWaitingOn.p1 && winnerMatchWaitingOn.p2 ? await Entry.findOne({ where: { tournamentId: tournament.id, participantId: winnerMatchWaitingOn.p1 }, include: Player }) : null
    const winnerWaitingOnP2 = winnerMatchWaitingOn && winnerMatchWaitingOn.p1 && winnerMatchWaitingOn.p2 ? await Entry.findOne({ where: { tournamentId: tournament.id, participantId: winnerMatchWaitingOn.p2 }, include: Player }) : null

    const loserEliminated = tournament.type === 'single elimination' ? true :
        tournament.type === 'double elimination' && losingEntry.losses >= 2 ? true :
        false

    if (loserEliminated) {
        const entries = await Entry.count({ where: { playerId: losingPlayer.id } })
        if (entries === 1) {
            const member = message.guild.members.cache.get(losingEntry.playerId)
            if (member) member.roles.remove(tourRole)
        }
        await losingEntry.destroy()
    }

    const loserNextMatch = loserEliminated ? null : findNextMatch(updatedMatchesArr, matchId, losingEntry.participantId)
    const loserNextOpponent = loserNextMatch ? await findNextOpponent(tournament.id, updatedMatchesArr, loserNextMatch, losingEntry.participantId) : null
    const loserMatchWaitingOn = loserNextOpponent ? null : findOtherPreReqMatch(updatedMatchesArr, loserNextMatch, matchId) 
    const loserWaitingOnP1 = loserMatchWaitingOn && loserMatchWaitingOn.p1 && loserMatchWaitingOn.p2 ? await Entry.findOne({ where: { tournamentId: tournament.id, participantId: loserMatchWaitingOn.p1 }, include: Player }) : null
    const loserWaitingOnP2 = loserMatchWaitingOn && loserMatchWaitingOn.p1 && loserMatchWaitingOn.p2 ? await Entry.findOne({ where: { tournamentId: tournament.id, participantId: loserMatchWaitingOn.p2 }, include: Player }) : null

    setTimeout(() => {
        if (loserEliminated) return message.channel.send({ content: `${losingPlayer.name}, You are eliminated from the tournament. Better luck next time!`})
        else if (loserNextOpponent) return message.channel.send({ content: `New Match: <@${losingPlayer.id}> (DB: ${losingPlayer.duelingBook}) vs. <@${loserNextOpponent.playerId}> (DB: ${loserNextOpponent.player.duelingBook}). Good luck to both duelists.`})
        else if (loserMatchWaitingOn && loserWaitingOnP1 && loserWaitingOnP2) {
            return message.channel.send({ content: `${losingPlayer.name}, You are waiting for the result of ${loserWaitingOnP1.player.name} (DB: ${loserWaitingOnP1.player.duelingBook}) vs ${loserWaitingOnP2.player.name} (DB: ${loserWaitingOnP2.player.duelingBook}).`})
        }
        else return message.channel.send({ content: `${losingPlayer.name}, You are waiting for multiple matches to finish. Grab a snack and stay hydrated.`})
    }, 2000)
    
    if (!winnerNextMatch || (winnerNextMatch && loserNextMatch !== winnerNextMatch)) {
        setTimeout(() => {
            if (!winnerNextMatch) return message.channel.send({ content: `<@${winningPlayer.id}>, You won the tournament! Congratulations on your stellar performance! ${dandy}`})
            else if (winnerNextOpponent) return message.channel.send({ content: `New Match: <@${winningPlayer.id}> (DB: ${winningPlayer.duelingBook}) vs. <@${winnerNextOpponent.playerId}> (DB: ${winnerNextOpponent.player.duelingBook}). Good luck to both duelists.`})
            else if (winnerMatchWaitingOn && winnerWaitingOnP1 && winnerWaitingOnP2) {
                return message.channel.send({ content: `${winningPlayer.name}, You are waiting for the result of ${winnerWaitingOnP1.player.name} (DB: ${winnerWaitingOnP1.player.duelingBook}) vs ${winnerWaitingOnP2.player.name} (DB: ${winnerWaitingOnP2.player.duelingBook}).`})
            }
            else return message.channel.send({ content: `${winningPlayer.name}, You are waiting for multiple matches to finish. Grab a snack and stay hydrated.`})
        }, 4000)
    }

    return true
}

module.exports = {
    askForDBName,
    checkPairing,
    createSheetData,
    findNextMatch,
    findNextOpponent,
    findNoShowOpponent,
    findOtherPreReqMatch,
    getDeckList,
    getDeckName,
    getPairing,
    getTournamentType,
    getMatches,
    processMatchResult,
    postParticipant,
    removeParticipant,
    seed,
    selectTournament
}