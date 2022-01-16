
//UTILITY FUNCTIONS

//MODULE IMPORTS
const fs = require('fs')
const Discord = require('discord.js')
const { Op } = require('sequelize')

//DATABASE IMPORTS
const { Card, Info, Membership, Player, Role } = require('../db/index.js')

//STATIC IMPORTS
const { mad, sad, rock, bronze, silver, gold, platinum, diamond, master, legend, deity } = require('../static/emojis.json')
const { adminRole, modRole, tourRole } = require('../static/roles.json')

//ASSIGN ROLES
const assignRoles = async (guild, member) => {
    const membership = await Membership.findOne({ where: { playerId: member.user.id, guildId: guild.id }})
    if (!membership) return
    const roles = await Role.findAll({ where: { membershipId: membership.id } })
    roles.forEach(async (r) => { 
        try {
            await member.roles.add(r.roleId) 
        } catch (err) {
            console.log(err)
        }
    })
}

//CAPITALIZE
const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1)

//CLEAR STATUS
const clearStatus = async (element) => {
    const info = await Info.findOne({ where: { element } })
    if (!info) return false
    info.status = 'free'
    console.log(`${element} is now free`)
    await info.save()
    return true
}

//CONVERT ARRAY TO OBJECT
const convertArrayToObject = (arr) => {
    const obj = {}
    arr.forEach(e => obj[e] ? obj[e]++ : obj[e] = 1)
    return obj
}

//CREATE PLAYER
const createPlayer = async (member) => {
    if (!member.user.bot) {
        try {
            await Player.create({
                id: `${member.user.id}`,
                name: `${member.user.username}`,
                tag: `${member.user.tag}`
            })
        } catch (err) {
            console.log(err)
        }
    }
}

//CREATE MEMBERSHIP
const createMembership = async (guild, member) => {
    try {
        await Membership.create({
            guildId: guild.id,
            guildName: guild.name,
            playerId: `${member.user.id}`
        })
    } catch (err) {
        console.log(err)
    }
}

//GENERATE RANDOM STRING
const generateRandomString = (length, chars) => {
    let result = '';
    for (let i = length; i > 0; --i) {
        result += chars[Math.floor(Math.random() * chars.length)]
    }
    return result
}

//GET DECK CATEGORY
const getDeckCategory = (deckType) => {
    return (deckType === 'blackwing' ||
        deckType === 'flamvell' ||
        deckType === 'gadget' ||
        deckType === 'gladiator beast' ||
        deckType === 'gravekeeper' ||
        deckType === 'hero beatdown' ||
        deckType === 'machina' ||
        deckType === 'six samurai' ||
        deckType === 'stun' ||
        deckType === 'zombie') ? 'aggro'
        : (deckType === 'counter fairy') ? 'lockdown'
        : (deckType === 'dragon turbo' ||
        deckType === 'empty jar' ||
        deckType === 'exodia' ||
        deckType === 'fairy turbo' ||
        deckType === 'fish otk' ||
        deckType === 'synchro cat' ||
        deckType === 'x-saber') ? 'combo'
        : (deckType === 'diva frog' ||
        deckType === 'diva hero' ||
        deckType === 'frog monarch' ||
        deckType === 'lightsworn' ||
        deckType === 'quickdraw plant' ||
        deckType === 'quickdraw zombie' ||
        deckType === 'vayu turbo' ||
        deckType === 'volcanic' ||
        deckType === 'volcanic quickdraw') ? 'control'
        : 'other'
}

//GET MEDAL
const getMedal = (stats, title = false) => {
    if (title) {
        return stats <= 230 ? `Tilted ${mad}`
        : (stats > 230 && stats <= 290) ?  `Chump ${sad}`
        : (stats > 290 && stats <= 350) ?  `Rock ${rock}`
        : (stats > 350 && stats <= 410) ?  `Bronze ${bronze}`
        : (stats > 410 && stats <= 470) ?  `Silver ${silver}`
        : (stats > 470 && stats <= 530) ?  `Gold ${gold}`
        : (stats > 530 && stats <= 590) ?  `Platinum ${platinum}`
        : (stats > 590 && stats <= 650) ?  `Diamond ${diamond}`
        : (stats > 650 && stats <= 710) ?  `Master ${master}`
        : (stats > 710 && stats <= 770) ?  `Legend ${legend}`
        : `Deity ${deity}`
    } else {
        return stats <= 230 ? mad
        : (stats > 230 && stats <= 290) ? sad
        : (stats > 290 && stats <= 350) ? rock
        : (stats > 350 && stats <= 410) ? bronze
        : (stats > 410 && stats <= 470) ? silver
        : (stats > 470 && stats <= 530) ? gold
        : (stats > 530 && stats <= 590) ? platinum
        : (stats > 590 && stats <= 650) ? diamond
        : (stats > 650 && stats <= 710) ? master
        : (stats > 710 && stats <= 770) ? legend
        : deity
    }
}

//GET RANDOM ELEMENT
const getRandomElement = (arr) => {
    const index = Math.floor((arr.length) * Math.random())
    return arr[index]
}

//GET RANDOM SUBSET
const getRandomSubset = (arr, n) => {
    const shuffledArr = arr.slice(0)
    let i = arr.length
    let temp
    let index

    while (i--) {
        index = Math.floor((i + 1) * Math.random())
        temp = shuffledArr[index]
        shuffledArr[index] = shuffledArr[i]
        shuffledArr[i] = temp
    }

    return shuffledArr.slice(0, n)
}

//FETCH CARD NAMES
const fetchCardNames = async () => {
    const names = [...await Card.findAll()].map((card) => card.name)
    return names
}

//FIND CARD
const findCard = async (query, fuzzyCards) => {
    const fuzzy_search = fuzzyCards.get(query, null, 0.36) || []
	fuzzy_search.sort((a, b) => b[0] - a[0])
	if (!fuzzy_search[0]) return false

	let partial_match
	if (query.length >= 10) {
		for (let i = 0; i < fuzzy_search.length; i++) {
			const result = fuzzy_search[i][1]
			if (result.replace(/[^\w\s]/gi, "").toLowerCase().includes(query.toLowerCase())) {
				partial_match = result
				break
			}
		}
	}

	const card_name = partial_match ? partial_match :
		fuzzy_search[0][0] > 0.5 ? fuzzy_search[0][1] :
		null
		
    return card_name
}

//IS ADMIN?
const isAdmin = (member) => member.roles.cache.some(role => role.id === adminRole)

//IS MOD?
const isMod = (member) => member.roles.cache.some(role => role.id === modRole || role.id === adminRole)

//IS NEW MEMBER?
const isNewUser = async (id) => !await Player.count({ where: { id } })

//IS NEW MEMBER?
const isNewMember = async (guildId, playerId) => !await Membership.count({ where: { guildId, playerId } })

//IS PROGRAMMER?
const isProgrammer = (member) => member.user.id === '194147938786738176'

//IS TOURNAMENT PLAYER?
const isTourPlayer = (member) => member.roles.cache.some(role => role.id === tourRole)

//SEARCH
const search = async (query, fuzzyCards) => {
	const card_name = await findCard(query, fuzzyCards)
	if (!card_name) return false

	const card = await Card.findOne({ 
		where: { 
			name: {
				[Op.iLike]: card_name
			}
		}
	})

	if (!card) return false
	const color = card.category === "Spell" ? "#42f578" :
		card.category === "Trap" ? "#e624ed" :
		card.category === "Monster" && card.fusion ? "#a930ff" :
		card.category === "Monster" && card.ritual ? "#3b7cf5" :
		card.category === "Monster" && card.synchro ? "#ebeef5" :
		card.category === "Monster" && card.xyz ? "#6e6e6e" :
		card.category === "Monster" && card.pendulum ? "#a5e096" :
		card.category === "Monster" && card.link ? "#468ef2" :
		card.category === "Monster" && card.normal ? "#faf18e" :
		card.category === "Monster" && card.effect ? "#f5b042" :
		null

	const classes = []
	if (card.normal) classes.push("Normal")
	if (card.fusion) classes.push("Fusion")
	if (card.ritual) classes.push("Ritual")
	if (card.synchro) classes.push("Synchro")
	if (card.xyz) classes.push("Xyz")
	if (card.pendulum) classes.push("Pendulum")
	if (card.link) classes.push("Link")
	if (card.flip) classes.push("Flip")
	if (card.gemini) classes.push("Gemini")
	if (card.spirit) classes.push("Spirit")
	if (card.toon) classes.push("Toon")
	if (card.tuner) classes.push("Tuner")
	if (card.union) classes.push("Union")
	if (card.effect) classes.push("Effect")

	const labels = card.category === "Monster" ? 
		`**Attribute:** ${card.attribute}` + 
		`\n${card.xyz ? `**Rank:** ${card.level}` : card.link ? `**Link Rating:** ${card.rating}` : `**Level:** ${card.level}`}` +
		`\n**Release Date:** ${card.tcg_date || 'OCG Only'}` +
		`\n**[** ${card.type} / ${classes.join(" / ")} **]**` :
		`**Category: ${card.icon}**` +
		`\n**Release Date:** ${card.tcg_date || 'OCG Only'}`
	
	const stats = card.category === "Monster" ? 
			`**ATK:** ${card.atk === null ? '?' : card.atk}` + 
			` ${!card.link ? `**DEF:** ${card.def === null ? '?' : card.def}` : ''}` :
			''
	
	const attachment = fs.existsSync(`../merchbot2/public/card_images/${card.image_file}`) ?
		new Discord.MessageAttachment(`../merchbot2/public/card_images/${card.image_file}`, card.image_file) :
		false

	const thumbnail = attachment ? `attachment://${card.image_file}` : `https://ygoprodeck.com/pics/${card.image_file}`
	const cardEmbed = new Discord.MessageEmbed()
	cardEmbed.setColor(color)
	cardEmbed.setTitle(card.name)
	cardEmbed.setThumbnail(thumbnail)
	cardEmbed.setDescription(`${labels}\n\n${card.description}\n\n${stats}`)
	return { cardEmbed, attachment }
}

//SHUFFLE ARRAY
const shuffleArray = (arr) => {
    let i = arr.length
    let temp
    let index

    while (i--) {
        index = Math.floor((i + 1) * Math.random())
        temp = arr[index]
        arr[index] = arr[i]
        arr[i] = temp
    }

    return arr
}

module.exports = {
    assignRoles,
    capitalize,
    convertArrayToObject,
    clearStatus,
    createMembership,
    createPlayer,
    fetchCardNames,
    generateRandomString,
    getDeckCategory,
    getMedal,
    getRandomElement,
    getRandomSubset,
    isAdmin,
    isMod,
    isNewMember,
    isNewUser,
    isProgrammer,
    isTourPlayer,
    search,
    shuffleArray
}
