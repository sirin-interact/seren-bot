import { EmbedBuilder, Guild, PermissionFlagsBits, spoiler } from "discord.js"
import { env } from '.'
import { BOT_COLOR } from "./lib"
import { setDefaultBlockword } from "./utils/blockWord"
import { addAllGuildChannel } from "./utils/channel"
import { getGuildOwner } from "./utils/discord"
import { addOrUpdateGuildData } from "./utils/guildData"
import { setDefaultGuildOption } from "./utils/guildOption"
import { addGuildLogSetting } from "./utils/log"
import { addMemberData } from "./utils/memberData"
import { addAllGuildRole, setRoleToMod } from "./utils/role"
import { addUserData } from "./utils/userData"

const thanksForUsing = (guildId: string) => {
    return new EmbedBuilder()
        .setColor(BOT_COLOR)
        .setTitle(':wave: Seren을 선택해주셔서 감사합니다!')
        .setURL(`${env.SITE}/dashboard/${guildId}`)
        .setDescription('**선택해주셔서 감사합니다!**\nSeren은 아직 베타 서비스중이므로 불안정합니다. 이점 양해 부탁드립니다.\n정상적인 사용을 위해선 Seren 역할을 맨 위로 올려주세요.\n공식 지원 센터 : https://discord.gg/invite/TDuC6dGDTa')
}

export default async function guildSetting(guild: Guild) {
    const guildId = guild.id
    await addOrUpdateGuildData(guild)
    await setDefaultGuildOption(guildId)
    await setDefaultBlockword(guildId)
    await addAllGuildChannel(guild)
    await addAllGuildRole(guild)
    await addGuildLogSetting(guild.id)

    const owner = await guild.fetchOwner()
    const adminRoleList = (await guild.roles.fetch()).filter(r => r.permissions.has(PermissionFlagsBits.Administrator))
    adminRoleList.forEach(async r => await setRoleToMod(r))

    guild.members.fetch().then(async members => {
        for (const member of members.values()) {
            if (member.user.bot) continue
            addMemberData(member)
            addUserData(member.user.id)
        }
    })

    await (owner.send({ embeds: [thanksForUsing(guildId)] }))
}
