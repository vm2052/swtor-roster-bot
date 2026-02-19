const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, MessageFlags , ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const Database = require('./database.js');
const init = require('./setup.js');
const { isValidEmoji, sanitizeEmoji, createOption, validateBranchEmojis } = require('./emoji-utils.js');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
const db = new Database();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Store temporary data for multi-step processes
const tempStore = new Map();
app.get('/', (req, res) => {
    res.send('Discord bot is running!');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ HTTP server listening on port ${PORT}`);
});
// ========== ROSTER DISPLAY FUNCTIONS ==========
async function registerCommands() {
    const commands = [
        new SlashCommandBuilder()
            .setName('panel')
            .setDescription('Open the staff roster panel')
            .setDefaultMemberPermissions(0) // visible to everyone, but we enforce perms manually
            .toJSON()
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    await rest.put(
        Routes.applicationGuildCommands(
            process.env.CLIENT_ID,
            process.env.GUILD_ID
        ),
        { body: commands }
    );

    console.log('✅ Slash commands registered');
}
async function updateBranchMessage(branchId) {
    try {
        const branchData = await db.getBranchForDisplay(branchId);
        if (!branchData) return;

        const channel = await client.channels.fetch(process.env.ROSTER_CHANNEL_ID);
        
        // Ensure emoji is valid for display
        const displayEmoji = sanitizeEmoji(branchData.emoji, '📋');
        
        const embed = new EmbedBuilder()
            .setColor('#990000')
            .setTitle(`${displayEmoji} ${branchData.name}`)
            .setTimestamp();

        let totalMembers = 0;
        let currentFieldContent = '';
        let fieldCount = 0;
        const MAX_FIELD_LENGTH = 1024;
        
        const addField = (content) => {
            if (content.trim().length === 0) return;
            
            if (fieldCount === 0) {
                embed.addFields({ 
                    name: `━━━━━━━━━━━━━━━━━━━━━━\nTotal Members: ${totalMembers}`, 
                    value: content.substring(0, MAX_FIELD_LENGTH) 
                });
            } else {
                embed.addFields({ 
                    name: ` `, 
                    value: content.substring(0, MAX_FIELD_LENGTH) 
                });
            }
            fieldCount++;
        };

        if (branchData.type === 'navy') {
            // Handle Navy (regular members first, then Talon Squadron)
            
            // Regular members by rank
            for (const [rankName, members] of Object.entries(branchData.byRank)) {
                const rankHeader = `\n**${rankName}**\n`;
                const rankContent = members.join('\n') + '\n';
                const rankSection = rankHeader + rankContent;
                
                totalMembers += members.length;

                if (currentFieldContent.length + rankSection.length > MAX_FIELD_LENGTH) {
                    if (currentFieldContent.length > 0) {
                        addField(currentFieldContent);
                    }
                    currentFieldContent = rankSection;
                } else {
                    currentFieldContent += rankSection;
                }
            }

            // Talon Squadron section
            if (branchData.specialSection && Object.keys(branchData.specialSection.byRank).length > 0) {
                const talonHeader = `\n__**${branchData.specialSection.name}**__\n`;
                
                if (currentFieldContent.length + talonHeader.length > MAX_FIELD_LENGTH) {
                    addField(currentFieldContent);
                    currentFieldContent = talonHeader;
                } else {
                    currentFieldContent += talonHeader;
                }
                
                for (const [rankName, members] of Object.entries(branchData.specialSection.byRank)) {
                    const rankHeader = `\n**${rankName}**\n`;
                    const rankContent = members.join('\n') + '\n';
                    const rankSection = rankHeader + rankContent;
                    
                    totalMembers += members.length;

                    if (currentFieldContent.length + rankSection.length > MAX_FIELD_LENGTH) {
                        addField(currentFieldContent);
                        currentFieldContent = rankSection;
                    } else {
                        currentFieldContent += rankSection;
                    }
                }
            }
        } else {
            // Handle standard branches with sub-branches (ISB, etc.)
            
            // Process MAIN branch first
            if (branchData.bySubBranch && branchData.bySubBranch['MAIN']) {
                const mainData = branchData.bySubBranch['MAIN'];
                
                for (const [rankName, members] of Object.entries(mainData.byRank)) {
                    const rankHeader = `\n**${rankName}**\n`;
                    const rankContent = members.join('\n') + '\n';
                    const rankSection = rankHeader + rankContent;
                    
                    totalMembers += members.length;

                    if (currentFieldContent.length + rankSection.length > MAX_FIELD_LENGTH) {
                        if (currentFieldContent.length > 0) {
                            addField(currentFieldContent);
                        }
                        currentFieldContent = rankSection;
                    } else {
                        currentFieldContent += rankSection;
                    }
                }
            }
            
            // Process other sub-branches
            if (branchData.bySubBranch) {
                for (const [subKey, subData] of Object.entries(branchData.bySubBranch)) {
                    if (subKey === 'MAIN') continue;
                    
                    const subHeader = `\n__**${subData.name}**__\n`;
                    
                    if (currentFieldContent.length + subHeader.length > MAX_FIELD_LENGTH) {
                        addField(currentFieldContent);
                        currentFieldContent = subHeader;
                    } else {
                        currentFieldContent += subHeader;
                    }
                    
                    for (const [rankName, members] of Object.entries(subData.byRank)) {
                        const rankHeader = `\n**${rankName}**\n`;
                        const rankContent = members.join('\n') + '\n';
                        const rankSection = rankHeader + rankContent;
                        
                        totalMembers += members.length;

                        if (currentFieldContent.length + rankSection.length > MAX_FIELD_LENGTH) {
                            addField(currentFieldContent);
                            currentFieldContent = rankSection;
                        } else {
                            currentFieldContent += rankSection;
                        }
                    }
                }
            }
        }

        // Add the last field
        if (currentFieldContent.length > 0) {
            addField(currentFieldContent);
        }

        // If no fields were added (empty branch)
        if (fieldCount === 0) {
            embed.setDescription('No members in this branch');
            embed.addFields({ 
                name: '━━━━━━━━━━━━━━━━━━━━━━', 
                value: 'No members assigned' 
            });
        }

        // Update or create the message
        if (branchData.message_id) {
            try {
                const message = await channel.messages.fetch(branchData.message_id);
                await message.edit({ embeds: [embed] });
                console.log(`✅ Updated ${branchData.name} message (${fieldCount} fields)`);
            } catch {
                const message = await channel.send({ embeds: [embed] });
                await db.updateBranchMessageId(branchId, message.id);
                console.log(`✅ Created new message for ${branchData.name} (${fieldCount} fields)`);
            }
        } else {
            const message = await channel.send({ embeds: [embed] });
            await db.updateBranchMessageId(branchId, message.id);
            console.log(`✅ Created new message for ${branchData.name} (${fieldCount} fields)`);
        }
    } catch (error) {
        console.error('Error updating branch message:', error);
    }
}

async function updateAllBranchMessages() {
    const branches = await db.getAllBranches();
    for (const branch of branches) {
        await updateBranchMessage(branch.id);
    }
}

// ========== CONTROL PANEL ==========

async function sendManagementPanel(channel) {
    const branches = await db.getAllBranches();
    
    // Validate branch emojis
    const validatedBranches = validateBranchEmojis(branches);

    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('add_member_start')
                .setLabel('➕ Add Member')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('remove_member')
                .setLabel('✖️ Remove Member')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('manage_branches')
                .setLabel('📁 Branches')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('manage_ranks')
                .setLabel('📊 Ranks')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('refresh_all')
                .setLabel('🔄 Refresh All')
                .setStyle(ButtonStyle.Secondary)
        );

    const panelEmbed = new EmbedBuilder()
        .setColor('#990000')
        .setTitle('🖥️ Roster Control Panel')
        .setDescription('**One message per branch**\nClick a button to manage the roster')
        .addFields(
            { name: '📊 Current Branches', value: validatedBranches.map(b => `${b.emoji} ${b.name}`).join('\n') || 'None' }
        );

    await channel.send({ embeds: [panelEmbed], components: [row1] });
}

// ========== INTERACTION HANDLERS ==========

// Command to show panel - ONLY visible to the staff member
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'panel') {

        // Permission check
        const member = interaction.member;
        const hasPermission =
            member.permissions.has('Administrator') ||
            member.permissions.has('ManageGuild') ||
            member.permissions.has('ManageRoles') ||
            member.permissions.has('ManageChannels');

        if (!hasPermission) {
            return interaction.reply({
                content: '❌ You need Administrator or Manage Server permissions.',
                ephemeral: true
            });
        }

        try {
            const branches = await db.getAllBranches();
            const validatedBranches = validateBranchEmojis(branches);

            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('add_member_start')
                    .setLabel('➕ Add Member')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('remove_member')
                    .setLabel('✖️ Remove Member')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('manage_branches')
                    .setLabel('📁 Branches')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('manage_ranks')
                    .setLabel('📊 Ranks')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('refresh_all')
                    .setLabel('🔄 Refresh All')
                    .setStyle(ButtonStyle.Secondary)
            );

            const panelEmbed = new EmbedBuilder()
                .setColor('#990000')
                .setTitle('🖥️ Roster Control Panel')
                .setDescription('**Staff Only** - Click a button to manage the roster')
                .addFields({
                    name: '📊 Current Branches',
                    value: validatedBranches.map(b => `${b.emoji} ${b.name}`).join('\n') || 'None'
                });

            await interaction.reply({
                embeds: [panelEmbed],
                components: [row1],
                ephemeral: true // 🔥 THIS is the magic
            });

        } catch (error) {
            console.error('Error showing panel:', error);
            if (!interaction.replied) {
                await interaction.reply({
                    content: '❌ Failed to open panel.',
                    ephemeral: true
                });
            }
        }
    }
});

client.on('interactionCreate', async (interaction) => {
     console.log('🔥 Interaction received:', {
        type: interaction.type,
        customId: interaction.customId,
        user: interaction.user.tag
    });
    if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit()) return;

    try {
        // ========== BUTTON HANDLERS ==========
        if (interaction.isButton()) {
            console.log('🔘 Button clicked with customId:', interaction.customId);
            // REFRESH ALL
            if (interaction.customId === 'refresh_all') {
               // await interaction.reply({ content: '🔄 Refreshing all branch messages...', flags: 64 });
                await replyAndAutoDelete(interaction, '🔄 Refreshing all branch messages...', { deleteDelay: 5000 });
                await updateAllBranchMessages();
                await interaction.editReply({ content: '✅ All branches refreshed!' });
            }

            // START ADD MEMBER PROCESS
            else if (interaction.customId === 'add_member_start') {
                const branches = await db.getAllBranches();
                
                if (branches.length === 0) {
                    // No branches, go straight to creating one
                    const modal = new ModalBuilder()
                        .setCustomId('create_branch_for_member')
                        .setTitle('Create First Branch');

                    const nameInput = new TextInputBuilder()
                        .setCustomId('branch_name')
                        .setLabel("Branch Name")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setPlaceholder('e.g., SITH ORDER');

                    const emojiInput = new TextInputBuilder()
                        .setCustomId('branch_emoji')
                        .setLabel("Emoji (optional)")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(false)
                        .setPlaceholder('e.g., 🔴 (must be valid Discord emoji)');

                    modal.addComponents(
                        new ActionRowBuilder().addComponents(nameInput),
                        new ActionRowBuilder().addComponents(emojiInput)
                    );

                    await interaction.showModal(modal);
                    return;
                }

                // Validate branch emojis
                const validatedBranches = validateBranchEmojis(branches);
                
                const options = [
                    ...validatedBranches.map(b => createOption(b.name, b.id.toString(), b.emoji)),
                    createOption('Create New Branch', 'new_branch', '➕')
                ];

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('add_member_select_branch')
                    .setPlaceholder('Select a branch')
                    .addOptions(options);

                const row = new ActionRowBuilder().addComponents(selectMenu);
                
               /* await interaction.reply({
                    content: '**Step 1/3:** Select a branch or create a new one:',
                    components: [row],
                    flags: 64
                });*/
                await replyAndAutoDelete(interaction, '**Step 1/3:** Select a branch or create a new one:', { components: [row] , deleteDelay: 50000 });
            }

            // REMOVE MEMBER
            else if (interaction.customId === 'remove_member') {
                const modal = new ModalBuilder()
                    .setCustomId('remove_member_modal')
                    .setTitle('Remove Member');

                const nameInput = new TextInputBuilder()
                    .setCustomId('member_name')
                    .setLabel("Member's Name")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setPlaceholder('Enter the exact name to remove');

                const row = new ActionRowBuilder().addComponents(nameInput);
                modal.addComponents(row);
                
                await interaction.showModal(modal);
            }

            // MANAGE BRANCHES
            else if (interaction.customId === 'manage_branches') {
                const branches = await db.getAllBranches();
                
                // Validate branch emojis
                const validatedBranches = validateBranchEmojis(branches);
                
                const options = [
                    createOption('Create New Branch', 'create_branch', '➕'),
                    ...validatedBranches.map(b => createOption(`Edit ${b.name}`, `edit_branch_${b.id}`, '✏️')),
                    ...validatedBranches.map(b => createOption(`Delete ${b.name}`, `delete_branch_${b.id}`, '🗑️'))
                ];

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('manage_branches_select')
                    .setPlaceholder('Select action')
                    .addOptions(options);

                const row = new ActionRowBuilder().addComponents(selectMenu);
                
                /*await interaction.reply({
                    content: 'Manage Branches:',
                    components: [row],
                    flags: 64
                });*/
                await replyAndAutoDelete(interaction, 'Manage Branches:', { components: [row] , deleteDelay: 50000 });
            }

            // MANAGE RANKS
            else if (interaction.customId === 'manage_ranks') {
                const branches = await db.getAllBranches();
                
                if (branches.length === 0) {
                    /*await interaction.reply({ 
                        content: '❌ No branches yet. Create a branch first!', 
                        flags: 64 
                    });*/
                    await replyAndAutoDelete(interaction, '❌ No branches yet. Create a branch first!', { deleteDelay: 5000 });
                    return;
                }

                // Validate branch emojis
                const validatedBranches = validateBranchEmojis(branches);
                
                const options = validatedBranches.map(b => createOption(b.name, b.id.toString(), b.emoji));

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('manage_ranks_select_branch')
                    .setPlaceholder('Select a branch')
                    .addOptions(options);

                const row = new ActionRowBuilder().addComponents(selectMenu);
                
               /*await interaction.reply({
                    content: 'Select a branch to manage its ranks:',
                    components: [row],
                    flags: 64
                });*/
                await replyAndAutoDelete(interaction, 'Select a branch to manage its ranks:', { components: [row] ,deleteDelay: 50000 });

            }
            else if (interaction.customId.startsWith('confirm_delete_branch_')) {
                try {
                    await interaction.deferUpdate();
                    
                    const branchId = parseInt(interaction.customId.replace('confirm_delete_branch_', ''));
                    console.log('✅ Deleted branch ID:', branchId);
                    
                    const branch = await db.getBranch(branchId);
                    
                    await db.deleteBranch(branchId);
                    
                    try {
                        const channel = await client.channels.fetch(process.env.ROSTER_CHANNEL_ID);
                        const message = await channel.messages.fetch(branch.message_id);
                        await message.delete();
                    } catch (e) {
                        // Message might not exist
                    }
                    
                    // Use editReply, NOT update
                    await interaction.editReply({
                        content: `✅ Deleted branch **${branch.name}** and all its members`,
                        components: []
                    });
                    
                } catch (error) {
                    console.error('Error in confirm delete branch:', error);
                    try {
                        await interaction.editReply({
                            content: '❌ An error occurred while deleting the branch',
                            components: []
                        }).catch(() => {});
                    } catch (e) {
                        // Ignore
                    }
                }
            }
            
            // CANCEL DELETE BRANCH
           else if (interaction.customId && interaction.customId.includes('cancel_delete_branch')) {
                try {
                    await interaction.deferUpdate();
                    
                    await interaction.editReply({  // Changed from update to editReply
                        content: '❌ Deletion cancelled.',
                        components: []
                    });
                    
                } catch (error) {
                    console.error('Error in cancel button:', error);
                }
            }

            // CONFIRM DELETE RANK
            else if (interaction.customId.startsWith('confirm_delete_rank_')) {
                const rankId = parseInt(interaction.customId.replace('confirm_delete_rank_', ''));
                const rank = await db.getRank(rankId);
                
                await db.deleteRank(rankId);
                await updateBranchMessage(rank.branch_id);
                
                await interaction.update({
                    content: `✅ Deleted rank **${rank.name}**`,
                    components: []
                });
            }

            // CANCEL DELETE RANK
            else if (interaction.customId.startsWith('cancel_delete_rank_')) {
                try {
                    await interaction.update({
                        content: '❌ Deletion cancelled.',
                        components: []
                    });
                } catch (error) {
                    console.error('Error cancelling deletion:', error);
                }
            }

            // GENERIC CANCEL DELETE (backward compatibility)
            else if (interaction.customId === 'cancel_delete') {
                await interaction.update({
                    content: '❌ Deletion cancelled',
                    components: []
                });
            }

        }

        // ========== SELECT MENU HANDLERS ==========
        else if (interaction.isStringSelectMenu()) {
            
            // ADD MEMBER - BRANCH SELECTION
            if (interaction.customId === 'add_member_select_branch') {
                const selected = interaction.values[0];
                
                if (selected === 'new_branch') {
                    const modal = new ModalBuilder()
                        .setCustomId('create_branch_for_member')
                        .setTitle('Create New Branch');

                    const nameInput = new TextInputBuilder()
                        .setCustomId('branch_name')
                        .setLabel("Branch Name")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setPlaceholder('e.g., JEDI ORDER');

                    const emojiInput = new TextInputBuilder()
                        .setCustomId('branch_emoji')
                        .setLabel("Emoji (optional)")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(false)
                        .setPlaceholder('e.g., 🔴 (must be valid Discord emoji)');

                    modal.addComponents(
                        new ActionRowBuilder().addComponents(nameInput),
                        new ActionRowBuilder().addComponents(emojiInput)
                    );

                    await interaction.showModal(modal);
                } else {
                    const branchId = parseInt(selected);
                    tempStore.set(interaction.user.id, { branchId });
                    
                    const ranks = await db.getRanksByBranch(branchId);
                    
                    if (ranks.length === 0) {
                        // No ranks, go straight to creating one
                        const modal = new ModalBuilder()
                            .setCustomId('create_rank_for_member')
                            .setTitle('Create First Rank');

                        const nameInput = new TextInputBuilder()
                            .setCustomId('rank_name')
                            .setLabel("Rank Name")
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                            .setPlaceholder('e.g., DARK COUNCIL');

                        modal.addComponents(new ActionRowBuilder().addComponents(nameInput));

                        await interaction.update({
                            content: 'This branch has no ranks. Create the first one:',
                            components: [],
                            flags: 64
                        });
                        await interaction.showModal(modal);
                        return;
                    }

                    const options = [
                        ...ranks.map(r => createOption(r.name, r.id.toString())),
                        createOption('Create New Rank', 'new_rank', '➕')
                    ];

                    const rankSelect = new StringSelectMenuBuilder()
                        .setCustomId('add_member_select_rank')
                        .setPlaceholder('Select a rank')
                        .addOptions(options);

                    const row = new ActionRowBuilder().addComponents(rankSelect);
                    
                    await interaction.update({
                        content: '**Step 2/3:** Select a rank or create a new one:',
                        components: [row]
                    });
                }
            }

            // ADD MEMBER - RANK SELECTION
            else if (interaction.customId === 'add_member_select_rank') {
                try {
                    const selected = interaction.values[0];
                    const userData = tempStore.get(interaction.user.id) || {};
                    
                    if (selected === 'new_rank') {
                        userData.creatingRank = true;
                        tempStore.set(interaction.user.id, userData);
                        
                        const modal = new ModalBuilder()
                            .setCustomId('create_rank_for_member')
                            .setTitle('Create New Rank');

                        const nameInput = new TextInputBuilder()
                            .setCustomId('rank_name')
                            .setLabel("Rank Name")
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                            .setPlaceholder('e.g., JEDI MASTER');

                        modal.addComponents(new ActionRowBuilder().addComponents(nameInput));

                        await interaction.showModal(modal);
                        
                    } else {
                        userData.rankId = parseInt(selected);
                        tempStore.set(interaction.user.id, userData);
                        
                        // Get sub-branches for this branch
                        const subBranches = await db.getSubBranchesByBranch(userData.branchId);
                        
                        if (subBranches.length > 0) {
                            // Create sub-branch selection menu
                            const options = [
                                createOption('None (Main Branch)', 'none', '📌'),
                                ...subBranches.map(sb => createOption(sb.name, sb.id.toString(), '📂'))
                            ];

                            const subBranchSelect = new StringSelectMenuBuilder()
                                .setCustomId('add_member_select_sub_branch')
                                .setPlaceholder('Select a sub-branch (optional)')
                                .addOptions(options);

                            const row = new ActionRowBuilder().addComponents(subBranchSelect);
                            
                            await interaction.update({
                                content: '**Step 3/4:** Select a sub-branch (optional):',
                                components: [row]
                            });
                        } else {
                            // No sub-branches, go straight to member details
                            const modal = new ModalBuilder()
                                .setCustomId('add_member_details')
                                .setTitle('Add Member Details');

                            const nameInput = new TextInputBuilder()
                                .setCustomId('name')
                                .setLabel("Character Name")
                                .setStyle(TextInputStyle.Short)
                                .setRequired(true)
                                .setPlaceholder('e.g., Darth Malgus');

                            const altInput = new TextInputBuilder()
                                .setCustomId('alt')
                                .setLabel("Legacy Name")
                                .setStyle(TextInputStyle.Short)
                                .setRequired(false)
                                .setPlaceholder('e.g., Duskfell, Nolan');

                            const titleInput = new TextInputBuilder()
                                .setCustomId('title')
                                .setLabel("Title/Role (optional)")
                                .setStyle(TextInputStyle.Short)
                                .setRequired(false)
                                .setPlaceholder('e.g., Marshall, Talon-1, App. to Darth Malgus');

                            modal.addComponents(
                                new ActionRowBuilder().addComponents(nameInput),
                                new ActionRowBuilder().addComponents(altInput),
                                new ActionRowBuilder().addComponents(titleInput)
                            );

                            await interaction.showModal(modal);
                        }
                    }
                } catch (error) {
                    console.error('Error in rank selection:', error);
                    if (!interaction.replied && !interaction.deferred) {
                      /*  await interaction.reply({ 
                            content: '❌ An error occurred. Please try again.',
                            flags: 64 
                        });*/
                        await replyAndAutoDelete(interaction, '❌ An error occurred. Please try again.', { deleteDelay: 5000 });
                    }
                }
            }

            // ADD MEMBER - SUB-BRANCH SELECTION
            else if (interaction.customId === 'add_member_select_sub_branch') {
                try {
                    const selected = interaction.values[0];
                    const userData = tempStore.get(interaction.user.id) || {};
                    
                    if (selected !== 'none') {
                        userData.subBranchId = parseInt(selected);
                        tempStore.set(interaction.user.id, userData);
                    }

                    // Create the modal
                    const modal = new ModalBuilder()
                        .setCustomId('add_member_details')
                        .setTitle('Add Member Details');

                    const nameInput = new TextInputBuilder()
                        .setCustomId('name')
                        .setLabel("Character Name")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setPlaceholder('e.g., Darth Malgus');

                    const altInput = new TextInputBuilder()
                        .setCustomId('alt')
                        .setLabel("Legacy Name")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(false)
                        .setPlaceholder('e.g., Duskfell, Nolan');

                    const titleInput = new TextInputBuilder()
                        .setCustomId('title')
                        .setLabel("Title/Role (optional)")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(false)
                        .setPlaceholder('e.g., Marshall, Talon-1, App. to Darth Malgus');

                    modal.addComponents(
                        new ActionRowBuilder().addComponents(nameInput),
                        new ActionRowBuilder().addComponents(altInput),
                        new ActionRowBuilder().addComponents(titleInput)
                    );

                    await interaction.showModal(modal);
                    
                } catch (error) {
                    console.error('Error in sub-branch selection:', error);
                    if (!interaction.replied && !interaction.deferred) {
                        /*await interaction.reply({ 
                            content: '❌ An error occurred. Please try again.',
                            flags: 64 
                        });*/
                       await replyAndAutoDelete(interaction, '❌ An error occurred. Please try again.', { deleteDelay: 5000 });
                    }
                }
            }

            // MANAGE BRANCHES
            else if (interaction.customId === 'manage_branches_select') {
                const selected = interaction.values[0];
                
                if (selected === 'create_branch') {
                    const modal = new ModalBuilder()
                        .setCustomId('create_branch')
                        .setTitle('Create New Branch');

                    const nameInput = new TextInputBuilder()
                        .setCustomId('name')
                        .setLabel("Branch Name")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);

                    const emojiInput = new TextInputBuilder()
                        .setCustomId('emoji')
                        .setLabel("Emoji (optional)")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(false)
                        .setPlaceholder('e.g., 🔴 (must be valid Discord emoji)');

                    modal.addComponents(
                        new ActionRowBuilder().addComponents(nameInput),
                        new ActionRowBuilder().addComponents(emojiInput)
                    );

                    await interaction.showModal(modal);
                } 
                else if (selected.startsWith('edit_branch_')) {
                    const branchId = parseInt(selected.replace('edit_branch_', ''));
                    const branch = await db.getBranch(branchId);
                    
                    const modal = new ModalBuilder()
                        .setCustomId(`edit_branch_${branchId}`)
                        .setTitle('Edit Branch');

                    const nameInput = new TextInputBuilder()
                        .setCustomId('name')
                        .setLabel("Branch Name")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setValue(branch.name);

                    const emojiInput = new TextInputBuilder()
                        .setCustomId('emoji')
                        .setLabel("Emoji (optional)")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(false)
                        .setValue(branch.emoji || '📋');

                    modal.addComponents(
                        new ActionRowBuilder().addComponents(nameInput),
                        new ActionRowBuilder().addComponents(emojiInput)
                    );

                    await interaction.showModal(modal);
                }
                else if (selected.startsWith('delete_branch_')) {
                    const branchId = parseInt(selected.replace('delete_branch_', ''));
                    const branch = await db.getBranch(branchId);
                    
                    const confirmRow = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(`confirm_delete_branch_${branchId}`)
                                .setLabel('✅ Yes, Delete')
                                .setStyle(ButtonStyle.Danger),
                            new ButtonBuilder()
                                .setCustomId(`cancel_delete_branch_${branchId}`)
                                .setLabel('❌ Cancel')
                                .setStyle(ButtonStyle.Secondary)
                        );

                    await interaction.update({
                        content: `⚠️ Are you sure you want to delete **${branch.name}** and ALL its members?`,
                        components: [confirmRow]
                    });
                }
            }

            // MANAGE RANKS - SELECT BRANCH
            else if (interaction.customId === 'manage_ranks_select_branch') {
                try {
                    const branchId = parseInt(interaction.values[0]);
                    const branch = await db.getBranch(branchId);
                    const ranks = await db.getRanksByBranch(branchId);
                    
                    // Build options
                    const options = [
                        createOption('Create New Rank', 'create_rank', '➕'),
                        ...ranks.map(rank => createOption(`Edit ${rank.name}`, `edit_rank_${rank.id}`, '✏️')),
                        ...ranks.map(rank => createOption(`Delete ${rank.name}`, `delete_rank_${rank.id}`, '❌'))
                    ];

                    const selectMenu = new StringSelectMenuBuilder()
                        .setCustomId(`manage_ranks_select_action_${branchId}`)
                        .setPlaceholder('Select an action')
                        .addOptions(options);

                    const row = new ActionRowBuilder().addComponents(selectMenu);
                    
                    const displayEmoji = sanitizeEmoji(branch.emoji, '📋');
                    
                    await interaction.update({
                        content: `**Managing ranks for ${displayEmoji} ${branch.name}**\nSelect an action:`,
                        components: [row]
                    });
                    
                } catch (error) {
                    console.error('Error in manage ranks branch selection:', error);
                    if (!interaction.replied && !interaction.deferred) {
                      /*  await interaction.reply({ 
                            content: '❌ An error occurred. Please try again.',
                            flags: 64 
                        });*/
                          await replyAndAutoDelete(interaction, '❌ An error occurred. Please try again.', { deleteDelay: 5000 });
                    }
                }
            }

            // MANAGE RANKS - SELECT ACTION
            else if (interaction.customId.startsWith('manage_ranks_select_action_')) {
                const branchId = parseInt(interaction.customId.split('_').pop());
                const selected = interaction.values[0];
                
                if (selected === 'create_rank') {
                    const modal = new ModalBuilder()
                        .setCustomId(`create_rank_${branchId}`)
                        .setTitle('Create New Rank');

                    const nameInput = new TextInputBuilder()
                        .setCustomId('name')
                        .setLabel("Rank Name")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);

                    modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
                    await interaction.showModal(modal);
                }
                else if (selected.startsWith('edit_rank_')) {
                    const rankId = parseInt(selected.replace('edit_rank_', ''));
                    const rank = await db.getRank(rankId);
                    
                    const modal = new ModalBuilder()
                        .setCustomId(`edit_rank_${rankId}`)
                        .setTitle('Edit Rank');

                    const nameInput = new TextInputBuilder()
                        .setCustomId('name')
                        .setLabel("Rank Name")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setValue(rank.name);

                    modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
                    await interaction.showModal(modal);
                }
                else if (selected.startsWith('delete_rank_')) {
                    const rankId = parseInt(selected.replace('delete_rank_', ''));
                    const rank = await db.getRank(rankId);
                    
                    const confirmRow = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(`confirm_delete_rank_${rankId}`)
                                .setLabel('✅ Yes, Delete')
                                .setStyle(ButtonStyle.Danger),
                            new ButtonBuilder()
                                .setCustomId(`cancel_delete_rank_${rankId}`)
                                .setLabel('❌ Cancel')
                                .setStyle(ButtonStyle.Secondary)
                        );

                    await interaction.update({
                        content: `⚠️ Are you sure you want to delete the rank **${rank.name}**?`,
                        components: [confirmRow]
                    });
                }
            }
        }

        // ========== MODAL HANDLERS ==========
        else if (interaction.isModalSubmit()) {
            
            // CREATE BRANCH DURING ADD MEMBER
            if (interaction.customId === 'create_branch_for_member') {
                try {
                    const name = interaction.fields.getTextInputValue('branch_name').toUpperCase();
                    const emojiInput = interaction.fields.getTextInputValue('branch_emoji');
                    
                    // Sanitize the emoji
                    const emoji = sanitizeEmoji(emojiInput, '📋');
                    
                    const branchId = await db.addBranch(name, emoji);
                    await updateBranchMessage(branchId);
                    
                    tempStore.set(interaction.user.id, { branchId, newBranch: true });
                    
                    // Now ask for rank
                    const modal = new ModalBuilder()
                        .setCustomId('create_rank_for_member')
                        .setTitle('Create First Rank');

                    const rankInput = new TextInputBuilder()
                        .setCustomId('rank_name')
                        .setLabel("Rank Name")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setPlaceholder('e.g., DARK COUNCIL');

                    modal.addComponents(new ActionRowBuilder().addComponents(rankInput));
                    
                   /* await interaction.reply({
                        content: `✅ Created branch **${name}** ${emoji}!\n\nNow create the first rank:`,
                        flags: 64
                    });*/
                     await replyAndAutoDelete(interaction, `✅ Created branch **${name}** ${emoji}!\n\nNow create the first rank:`, { deleteDelay: 50000 });
                    await interaction.showModal(modal);
                } catch (error) {
                    console.error('Error in create_branch_for_member modal:', error);
                   /* await interaction.reply({ 
                        content: '❌ Failed to create branch. Please try again.', 
                        flags: 64 
                    });*/
                      await replyAndAutoDelete(interaction, '❌ Failed to create branch. Please try again.', { deleteDelay: 5000 });
                }
            }

            // CREATE RANK DURING ADD MEMBER
            else if (interaction.customId === 'create_rank_for_member') {
                try {
                    const rankName = interaction.fields.getTextInputValue('rank_name').toUpperCase();
                    const userData = tempStore.get(interaction.user.id) || {};
                    
                    const rankId = await db.addRank(userData.branchId, rankName);
                    userData.rankId = rankId;
                    tempStore.set(interaction.user.id, userData);
                    
                    // Check for sub-branches
                    const subBranches = await db.getSubBranchesByBranch(userData.branchId);
                    
                    if (subBranches.length > 0) {
                        // Create sub-branch selection menu
                        const options = [
                            createOption('None (Main Branch)', 'none', '📌'),
                            ...subBranches.map(sb => createOption(sb.name, sb.id.toString(), '📂'))
                        ];

                        const subBranchSelect = new StringSelectMenuBuilder()
                            .setCustomId('add_member_select_sub_branch')
                            .setPlaceholder('Select a sub-branch (optional)')
                            .addOptions(options);

                        const row = new ActionRowBuilder().addComponents(subBranchSelect);
                        
                        await interaction.update({
                            content: `✅ Created rank **${rankName}**!\n\n**Step 3/4:** Select a sub-branch (optional):`,
                            components: [row]
                        });
                    } else {
                        // Go to member details modal
                        const modal = new ModalBuilder()
                            .setCustomId('add_member_details')
                            .setTitle('Add Member Details');

                        const nameInput = new TextInputBuilder()
                            .setCustomId('name')
                            .setLabel("Character Name")
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true);

                        const altInput = new TextInputBuilder()
                            .setCustomId('alt')
                            .setLabel("Legacy Name")
                            .setStyle(TextInputStyle.Short)
                            .setRequired(false);

                        const titleInput = new TextInputBuilder()
                            .setCustomId('title')
                            .setLabel("Title/Role")
                            .setStyle(TextInputStyle.Short)
                            .setRequired(false);

                        modal.addComponents(
                            new ActionRowBuilder().addComponents(nameInput),
                            new ActionRowBuilder().addComponents(altInput),
                            new ActionRowBuilder().addComponents(titleInput)
                        );

                      /*  await interaction.reply({
                            content: `✅ Created rank **${rankName}**!\n\nNow add member details:`,
                            flags: 64
                        });*/
                         await replyAndAutoDelete(interaction, `✅ Created rank **${rankName}**!\n\nNow add member details:`, { deleteDelay: 50000 });
                        await interaction.showModal(modal);
                    }
                } catch (error) {
                    console.error('Error in create_rank_for_member modal:', error);
                  /*  await interaction.reply({ 
                        content: '❌ Failed to create rank. Please try again.', 
                        flags: 64 
                    });*/
                      await replyAndAutoDelete(interaction, '❌ Failed to create rank. Please try again.', { deleteDelay: 5000 });
                        await interaction.showModal(modal);
                }
            }

            // ADD MEMBER DETAILS
            else if (interaction.customId === 'add_member_details') {
                try {
                    const userData = tempStore.get(interaction.user.id) || {};
                    
                    const name = interaction.fields.getTextInputValue('name');
                    const alt = interaction.fields.getTextInputValue('alt') || '';
                    const title = interaction.fields.getTextInputValue('title') || '';

                    await db.addCharacter(
                        userData.branchId,
                        userData.rankId,
                        name,
                        alt,
                        title,
                        userData.subBranchId || null
                    );

                    await updateBranchMessage(userData.branchId);
                    
                    tempStore.delete(interaction.user.id);
                    
                  /*  await interaction.reply({
                        content: `✅ Successfully added **${name}** to the roster!`,
                        flags: 64
                    });*/
                    await replyAndAutoDelete(interaction, `✅ Successfully added **${name}** to the roster!`, { deleteDelay: 5000 });
                } catch (error) {
                    console.error('Error in add_member_details modal:', error);
                    /*await interaction.reply({ 
                        content: '❌ Failed to add member. Please try again.', 
                        flags: 64 
                    });*/
                    await replyAndAutoDelete(interaction, '❌ Failed to add member. Please try again.', { deleteDelay: 5000 });
                }
            }

            // CREATE BRANCH (standalone)
            else if (interaction.customId === 'create_branch') {
                try {
                    const name = interaction.fields.getTextInputValue('name').toUpperCase();
                    const emojiInput = interaction.fields.getTextInputValue('emoji');
                    
                    // Sanitize the emoji
                    const emoji = sanitizeEmoji(emojiInput, '📋');
                    
                    const branchId = await db.addBranch(name, emoji);
                    await updateBranchMessage(branchId);
                    
                   /* await interaction.reply({
                        content: `✅ Created branch **${name}** ${emoji}`,
                        flags: 64
                    });*/
                      await replyAndAutoDelete(interaction, `✅ Created branch **${name}** ${emoji}`, { deleteDelay: 5000 });
                } catch (error) {
                    console.error('Error in create_branch modal:', error);
                   /* await interaction.reply({ 
                        content: '❌ Failed to create branch. Please try again.', 
                        flags: 64 
                    });*/
                      await replyAndAutoDelete(interaction, '❌ Failed to create branch. Please try again.', { deleteDelay: 5000 });
                }
            }

            // EDIT BRANCH
            else if (interaction.customId.startsWith('edit_branch_')) {
                try {
                    const branchId = parseInt(interaction.customId.replace('edit_branch_', ''));
                    const name = interaction.fields.getTextInputValue('name').toUpperCase();
                    const emojiInput = interaction.fields.getTextInputValue('emoji');
                    
                    // Sanitize the emoji
                    const emoji = sanitizeEmoji(emojiInput, '📋');
                    
                    await db.updateBranch(branchId, { name, emoji });
                    await updateBranchMessage(branchId);
                    
                   /* await interaction.reply({
                        content: `✅ Updated branch to **${name}** ${emoji}`,
                        flags: 64
                    });*/
                    await replyAndAutoDelete(interaction, `✅ Updated branch to **${name}** ${emoji}`, { deleteDelay: 5000 });
                } catch (error) {
                    console.error('Error in edit_branch modal:', error);
                 /*   await interaction.reply({ 
                        content: '❌ Failed to update branch. Please try again.', 
                        flags: 64 
                    });*/
                    await replyAndAutoDelete(interaction, '❌ Failed to update branch. Please try again.', { deleteDelay: 5000 });
                }
            }

            // CREATE RANK (standalone)
            else if (interaction.customId.startsWith('create_rank_')) {
                try {
                    const branchId = parseInt(interaction.customId.replace('create_rank_', ''));
                    const name = interaction.fields.getTextInputValue('name').toUpperCase();
                    
                    await db.addRank(branchId, name);
                    await updateBranchMessage(branchId);
                    
                   /* await interaction.reply({
                        content: `✅ Created rank **${name}**`,
                        flags: 64
                    });*/
                     await replyAndAutoDelete(interaction, `✅ Created rank **${name}**`, { deleteDelay: 5000 });
                } catch (error) {
                    console.error('Error in create_rank modal:', error);
                   /* await interaction.reply({ 
                        content: '❌ Failed to create rank. Please try again.', 
                        flags: 64 
                    });*/
                      await replyAndAutoDelete(interaction, '❌ Failed to create rank. Please try again.', { deleteDelay: 5000 });
                }
            }

            // EDIT RANK
            else if (interaction.customId.startsWith('edit_rank_')) {
                try {
                    const rankId = parseInt(interaction.customId.replace('edit_rank_', ''));
                    const name = interaction.fields.getTextInputValue('name').toUpperCase();
                    
                    const rank = await db.getRank(rankId);
                    await db.updateRank(rankId, { name });
                    await updateBranchMessage(rank.branch_id);
                    
                   /* await interaction.reply({
                        content: `✅ Updated rank to **${name}**`,
                        flags: 64
                    });*/
                     await replyAndAutoDelete(interaction, `✅ Updated rank to **${name}**`, { deleteDelay: 5000 });
                } catch (error) {
                    console.error('Error in edit_rank modal:', error);
                   /* await interaction.reply({ 
                        content: '❌ Failed to update rank. Please try again.', 
                        flags: 64 
                    });*/
                    await replyAndAutoDelete(interaction, '❌ Failed to update rank. Please try again.', { deleteDelay: 5000 });
                }
            }

            // REMOVE MEMBER MODAL HANDLER
            else if (interaction.customId === 'remove_member_modal') {
                await interaction.deferReply({ flags: 64 });
                
                const name = interaction.fields.getTextInputValue('member_name').trim();
                console.log(`Attempting to remove character: "${name}"`);
                
                try {
                    // First, get the character to find its branch_id
                    const allCharacters = await db.getAllCharacters();
                    const member = allCharacters.find(c => 
                        c.name.toLowerCase() === name.toLowerCase() ||
                        c.name.toLowerCase().includes(name.toLowerCase())
                    );
                    
                    if (!member) {
                        await interaction.editReply({ 
                            content: `❌ Could not find **${name}** in the roster.` 
                        });
                        return;
                    }
                    
                    console.log(`Found character: ${member.name} (ID: ${member.id}) in branch ${member.branch_id}`);
                    
                    // Remove the character
                    const result = await db.removeCharacter(member.name);
                    console.log(`Remove character result:`, result);
                    
                    // Check if removal was successful (result > 0 OR result === true)
                    if (result > 0 || result === true) {
                        await updateBranchMessage(member.branch_id);
                        await interaction.editReply({ content: `✅ Successfully removed **${member.name}** from roster` });
                    } else {
                        // Double-check if the character was actually deleted
                        const checkAgain = await db.getAllCharacters();
                        const stillExists = checkAgain.some(c => c.name === member.name);
                        
                        if (!stillExists) {
                            console.log('Character was deleted despite result code, updating anyway');
                            await updateBranchMessage(member.branch_id);
                            await interaction.editReply({ content: `✅ Successfully removed **${member.name}** from roster` });
                        } else {
                            console.error(`Failed to remove character:`, result);
                            await interaction.editReply({ content: `❌ Failed to remove **${member.name}**.` });
                        }
                    }
                    
                } catch (error) {
                    console.error('Error removing member:', error);
                    await interaction.editReply({ content: '❌ An error occurred while removing the member' });
                }
            }
        }

        // ========== CONFIRMATION BUTTONS ==========
        /*else if (interaction.isButton()) {
            console.log('Button clicked with customId:', interaction.customId);
            // CONFIRM DELETE BRANCH
            if (interaction.customId.startsWith('confirm_delete_branch_')) {
                await interaction.deferUpdate();
                const branchId = parseInt(interaction.customId.replace('confirm_delete_branch_', ''));
                console.log(branchId);
                const branch = await db.getBranch(branchId);
                
                await db.deleteBranch(branchId);
                
                try {
                    const channel = await client.channels.fetch(process.env.ROSTER_CHANNEL_ID);
                    const message = await channel.messages.fetch(branch.message_id);
                    await message.delete();
                } catch (e) {
                    // Message might not exist
                }
                
                await interaction.update({
                    content: `✅ Deleted branch **${branch.name}** and all its members`,
                    components: []
                });
            }
            
            // CANCEL DELETE BRANCH
            else if (interaction.customId && interaction.customId.includes('cancel_delete_branch')) {
                try {
                    console.log('Cancel button clicked with ID:', interaction.customId);
                    
                    // First, acknowledge the interaction
                    await interaction.deferUpdate();
                    
                    // Then edit the message
                    await interaction.editReply({
                        content: '❌ Deletion cancelled.',
                        components: []
                    });
                    
                } catch (error) {
                    console.error('Error in cancel button:', error);
                    
                    // If deferUpdate failed, try direct update
                    try {
                        await interaction.update({
                            content: '❌ Deletion cancelled.',
                            components: []
                        });
                    } catch (updateError) {
                        console.error('Update also failed:', updateError);
                    }
                }
            }

            // CONFIRM DELETE RANK
            else if (interaction.customId.startsWith('confirm_delete_rank_')) {
                const rankId = parseInt(interaction.customId.replace('confirm_delete_rank_', ''));
                const rank = await db.getRank(rankId);
                
                await db.deleteRank(rankId);
                await updateBranchMessage(rank.branch_id);
                
                await interaction.update({
                    content: `✅ Deleted rank **${rank.name}**`,
                    components: []
                });
            }

            // CANCEL DELETE RANK
            else if (interaction.customId.startsWith('cancel_delete_rank_')) {
                try {
                    await interaction.update({
                        content: '❌ Deletion cancelled.',
                        components: []
                    });
                } catch (error) {
                    console.error('Error cancelling deletion:', error);
                }
            }

            // GENERIC CANCEL DELETE (backward compatibility)
            else if (interaction.customId === 'cancel_delete') {
                await interaction.update({
                    content: '❌ Deletion cancelled',
                    components: []
                });
            }
        }*/
    } catch (error) {
        console.error('Interaction error:', error);
        if (!interaction.replied && !interaction.deferred) {
           /* await interaction.reply({ 
                content: '❌ An error occurred. Please try again.', 
                flags: 64 
            }).catch(() => {});*/
            await replyAndAutoDelete(interaction, '❌ An error occurred. Please try again.', { deleteDelay: 5000 }).catch(() => {});
        }
    }
});

client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
     await registerCommands();
    try {
        await db.initialize();
        await init(db);
        
        const channel = await client.channels.fetch(process.env.ROSTER_CHANNEL_ID);
        await updateAllBranchMessages();
        
        console.log('🚀 Bot is ready!');
        console.log('ℹ️ Staff can use !panel command for admin controls');
    } catch (error) {
        console.error('❌ Failed to initialize bot:', error);
    }
});
// Add this helper function near the top of your file
async function replyAndAutoDelete(interaction, content, options = {}) {
    const deleteDelay = options.deleteDelay || 5000; // Default 10 seconds
     const replyOptions = {
        ...options,
        flags: 64 // ephemeral
    };
    
    if (typeof content === 'string') {
        replyOptions.content = content;
    } else {
        // Handle when content is an object with embeds, etc.
        Object.assign(replyOptions, content);
    }
    
    const reply = await interaction.reply(replyOptions);
    
    // Auto-delete after delay
    setTimeout(async () => {
        try {
            await interaction.deleteReply();
        } catch (error) {
            // Ignore errors if message already deleted
        }
    }, deleteDelay);
}
client.login(process.env.DISCORD_TOKEN);