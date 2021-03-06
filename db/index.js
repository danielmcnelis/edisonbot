
const { db } = require('./db')
const Card = require('./Card')
const Entry = require('./Entry')
const Info = require('./Info')
const Match = require('./Match')
const Matchup = require('./Matchup')
const Membership = require('./Membership')
const Player = require('./Player')
const Role = require('./Role')
const Stats = require('./Stats')
const Status = require('./Status')
const Tournament = require('./Tournament')

Stats.belongsTo(Player)
Player.hasMany(Stats)

Membership.belongsTo(Player)
Player.hasMany(Membership)

Role.belongsTo(Membership)
Membership.hasMany(Role)

Entry.belongsTo(Player)
Player.hasMany(Entry)

Entry.belongsTo(Tournament)
Tournament.hasMany(Entry)

Status.belongsTo(Card)
Card.hasOne(Status)

Matchup.belongsTo(Match)
Match.hasOne(Matchup)

Matchup.belongsTo(Tournament)
Tournament.hasMany(Matchup)

module.exports = {
  db,
  Card,
  Entry,
  Info,
  Match,
  Matchup,
  Membership,
  Player,
  Role,
  Stats,
  Status,
  Tournament
}
