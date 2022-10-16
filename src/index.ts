import 'dotenv/config'
import * as dotenv from 'dotenv'

dotenv.config({ path: __dirname+'../.env' })

export const env = process.env

import { ChannelType, Client, GatewayIntentBits, GuildMember, userMention } from 'discord.js'
import { getCommandFunction, usableInDM } from './commands'
import guildSetting from './guildSetting'
import { goodbye, welcome } from './welcome'
import openAPIServer from './api'
import { BOT_COLOR } from './lib'
import { addGuildChannel, removeGuildChannel, modifyGuildChannel } from './utils/channel'
import { addSlashCommands, errorMessage } from './utils/default'
import { getChannel, getGuildOwner, getMember } from './utils/discord'
import { addOrUpdateGuildData, getGuildData, removeGuildData } from './utils/guildData'
import { addMemberData, removeMemberData, updateMemberData } from './utils/memberData'
import { addMod, removeMod } from './utils/mod'
import { addBan, getBanListFromAPI, removeBan, updateBanListCache } from './utils/ban'
import { getGuildOption } from './utils/guildOption'
import { someoneHasBan, someoneHasUnban } from './Commands/ban'
import { addGuildRole, getGuildModRole, getGuildRole } from './utils/role'
import { getGuildLogSetting, log } from './utils/log'
import { addMemberExp, checkLevelUp } from './utils/level'
import { coinNameAutoComplete, ownedCoinAutoComplete } from './utils/coin'
import coinGame from './coin/coin'
import { addUserData, getUserData } from './utils/userData'
import { scanMessage } from './utils/blockWord'
import { KoreanbotsClient } from "koreanbots"
import { removeGuildRole } from './utils/role'
import { modifyGuildRole } from './utils/role'
import startWeeklyPoint from './coin/weeklyPoint'

const clientIntents = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMessageTyping,
    GatewayIntentBits.DirectMessageTyping
]
const KOREAN_TOKEN = env.KOREAN_TOKEN
export let client = new Client({ intents: clientIntents }) as KoreanbotsClient

if(env.NODE_ENV === 'production'){
    client = new KoreanbotsClient({ 
        intents: clientIntents,
        koreanbots: {
            api: {
                token: KOREAN_TOKEN!
            }
        },
        koreanbotsClient: {
            updateInterval: 600000 //10분마다 서버 수를 업데이트합니다. (기본값 30분)
        }
    })
}

client.on('ready', async () => {
	console.log(`Logged in as ${client.user?.tag}!`)
    console.log(`Version: ${env.VERSION} / Build: ${env.BUILD_DATE}`)
    console.log(`Mode : ${env.NODE_ENV}`)
    openAPIServer()
    coinGame()
    startWeeklyPoint()
    client.user!.setActivity('/안녕 , /도움말')

    await addSlashCommands()
})

client.on('messageCreate', async message => {
    try {
        if (!message.guild) return
        if (!message.member) return
        if (message.author.bot) return
        if (!message.channel || message.channel.isDMBased()) return
        
        const guildData = await getGuildData(message.guild.id)
        if (!guildData) return

        scanMessage(message)

        await addMemberExp(message.member!, 10)
        await checkLevelUp(message.member!, message.channel)

        const exist = await getUserData(message.author.id)
        if (!exist) await addUserData(message.author.id)
    } catch { return }
})

client.on('interactionCreate', async (interaction) => {
    if (interaction.isAutocomplete()) {
        switch (interaction.commandName) {
            case '코인가격': { await coinNameAutoComplete(interaction); break }
            case '코인구매': { await coinNameAutoComplete(interaction); break }
            case '코인판매': { await ownedCoinAutoComplete(interaction); break }
            case '코인댓글': { await coinNameAutoComplete(interaction); break }
        }
        return
    }
    else if (interaction.isChatInputCommand()) {
        if (usableInDM.includes(interaction.commandName) && !interaction.channel) {
            try {
                return getCommandFunction()[interaction.commandName](interaction)
            } catch (error: any) {
                console.log(error)
                return interaction.reply({ embeds: [errorMessage()] })
            }
        } else {
            const logSetting = await getGuildLogSetting(interaction.guild!.id)
        
            try {
                getCommandFunction()[interaction.commandName](interaction)
                logSetting?.useCommand && log({
                    content: `명령어 사용 : ${interaction.member!.user.username} / 사용한 명령어 : ${interaction.commandName}`,
                    rawContent: `명령어 사용 : ${interaction.member} / 사용한 명령어 : ${interaction.commandName}`,
                    guild: interaction.guild!,
                    type: 'useCommand'
                })
                await addMemberExp(interaction.member! as GuildMember, 5)
                if (interaction.channel!.isDMBased()) return
                if (interaction.channel!.type !== ChannelType.GuildText) return
                await checkLevelUp(interaction.member! as GuildMember, interaction.channel!)
            } catch (error: any) {
                console.log(error)
                interaction.reply({ embeds: [errorMessage()] })
            }
        }
    }
})

client.on('guildCreate', async (guild) => {
    await removeGuildData(guild.id)
    await addMod(guild, await getGuildOwner(guild))
    guildSetting(guild)
    guild.roles.everyone.permissions.remove('MentionEveryone')
})

client.on('guildDelete', async (guild) => {
    try {
        removeGuildData(guild.id)
    } catch (error: any) {
        console.log(error)
    }
})

client.on('guildMemberAdd', async (member) => {
    await addMemberData(member)
    await addUserData(member.id)
    await welcome(member)
})

client.on('guildMemberRemove', async (member) => {
    if (member.id === client.user?.id) return
    await removeMemberData(member)
    await goodbye(member)
})

client.on('channelCreate', async (channel) => {
    if (channel.isDMBased()) return
    
    await addGuildChannel(channel)
})

client.on('channelDelete', async (channel) => {
    if (channel.isDMBased()) return

    await removeGuildChannel(channel)
})

client.on('channelUpdate', async (oldChannel, newChannel) => {
    if (oldChannel.isDMBased() || newChannel.isDMBased()) return

    await modifyGuildChannel(oldChannel, newChannel)
})

client.on('guildBanAdd', async banMember => {
    if (banMember.user.id === client.user?.id) return
    try {
        const thisGuild = banMember.guild
        await addBan(thisGuild.id, banMember)

        const option = (await getGuildOption(thisGuild.id))
        if (!option) return

        const logSetting = await getGuildLogSetting(thisGuild.id)
        const channel = await getChannel(thisGuild, option.banChannelId)

        logSetting?.addBan && log({
            content: `차단 추가됨 : ${banMember.user.username}`,
            rawContent: `차단 추가됨 : ${userMention(banMember.user.id)}`,
            guild: thisGuild,
            type: 'addBan'
        })

        if (!channel || !channel.isTextBased()) return
        option.banMessageEnabled && channel.send({ embeds: [someoneHasBan(banMember.user.tag, banMember.reason || '공개되지 않음')] })
    } catch (e) { console.log(e) }
})

client.on('guildBanRemove', async (banMember) => {
    try {
        const thisGuild = banMember.guild
        const option = (await getGuildOption(thisGuild.id))!
        const logSetting = await getGuildLogSetting(thisGuild.id)
        const channel = await getChannel(thisGuild, option.banChannelId)

        await removeBan(thisGuild.id, banMember.user.id)

        logSetting?.removeBan && log({
            content: `차단 해제됨 : ${banMember.user.username}`,
            rawContent: `차단 해제됨 : ${userMention(banMember.user.id)}`,
            guild: thisGuild,
            type: 'removeBan'
        })

        if (!channel || !channel.isTextBased()) return
        option.unbanMessageEnabled && channel.send({ embeds: [someoneHasUnban(banMember.user.username, banMember.reason || '공개되지 않음')] })

    } catch (e) { console.log(e) }
})

client.on('guildMemberUpdate', async (oldMember, newMember) => {
    if (oldMember.user.id === client.user?.id) return

    await updateMemberData(newMember)
    try {
        const modRoleId = (await getGuildModRole(newMember.guild)).id
        const thisGuild = oldMember.guild

        if (newMember.roles.cache.has(modRoleId)) {
            await addMod(thisGuild, newMember)
        } else if (!newMember.roles.cache.has(modRoleId) && oldMember.roles.cache.has(modRoleId)) {
            await removeMod(thisGuild, newMember)
        }

        const logSetting = (await getGuildLogSetting(newMember.guild.id))!
        const oldRoles = oldMember.roles.cache.map(r => r.id)
        const newRoles = newMember.roles.cache.map(r => r.id)

        const deletedRole = oldRoles.filter(r => !newRoles.includes(r))
        const addedRole = newRoles.filter(r => !oldRoles.includes(r))

        deletedRole.forEach(async id => {
            const role = await getGuildRole(thisGuild, id)
            if (!role) return
            logSetting?.removeRoleToMember && log({
                content: `역할 제거됨 : ${newMember.user.username} / 제거된 역할 : ${role.name}`,
                rawContent: `역할 제거됨 : ${userMention(newMember.id)} / 제거된 역할 : ${role.name}`,
                guild: thisGuild,
                type: 'removeRoleToMember'
            })
        })
        addedRole.forEach(async id => {
            const role = await getGuildRole(thisGuild, id)
            if (!role) return
            logSetting?.addRoleToMember && log({
                content: `역할 추가됨 : ${newMember.user.username} / 추가된 역할 : ${role.name}`,
                rawContent: `역할 추가됨 : ${userMention(newMember.id)} / 추가된 역할 : ${role.name}`,
                guild: thisGuild,
                type: 'addRoleToMember'
            })
        })
    } catch {
        return
    }
})

client.on('guildUpdate', async (oldGuild, newGuild) => {
    await addOrUpdateGuildData(newGuild)
})

client.on('messageDelete', async (message) => { 
    try {
        if (!message.guild) return
        const logSetting = await getGuildLogSetting(message.guildId!)
        logSetting?.removeMessage && log({
            content: `메세지 삭제됨 / 메세지 작성자 : ${message.member!.user.username} / 내용 : ${message.content || '알 수 없음 (null)'}`,
            rawContent: `메세지 삭제됨 / 메세지 작성자 : ${userMention(message.member!.id)} / 내용 : ${message.content || '알 수 없음 (null)'}`,
            guild: message.guild,
            type: 'removeMessage'
        })
    } catch { return }
})

client.on('roleCreate', async role => {
    await addGuildRole(role)
})

client.on('roleDelete', async role => {
    await removeGuildRole(role)
})

client.on('roleUpdate', async (oldRole, newRole) => {
    await modifyGuildRole(oldRole, newRole)
})

export default client

client.login(env.BOT_TOKEN)
