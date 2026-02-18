const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
require('dotenv').config();

const Database = require('./database.js');
const init = require('./setup.js');
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

// ========== ROSTER DISPLAY FUNCTIONS ==========

async function updateBranchMessage(branchId) {
    try {
        const branchData = await db.getBranchForDisplay(branchId);
        if (!branchData) return;

        const channel = await client.channels.fetch(process.env.ROSTER_CHANNEL_ID);
        
        const embed = new EmbedBuilder()
            .setColor('#990000')
            .setTitle(`${branchData.emoji} ${branchData.name}`)
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
            if (branchData.bySubBranch['MAIN']) {
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
            { name: '📊 Current Branches', value: branches.map(b => `${b.emoji} ${b.name}`).join('\n') || 'None' }
        );

    await channel.send({ embeds: [panelEmbed], components: [row1] });
}

// ========== INTERACTION HANDLERS ==========

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit()) return;

    try {
        // ========== BUTTON HANDLERS ==========
        if (interaction.isButton()) {
            
            // REFRESH ALL
            if (interaction.customId === 'refresh_all') {
                await interaction.reply({ content: '🔄 Refreshing all branch messages...', ephemeral: true });
                await updateAllBranchMessages();
                await interaction.editReply({ content: '✅ All branches refreshed!' });
            }

            // START ADD MEMBER PROCESS
            if (interaction.customId === 'add_member_start') {
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
                        .setLabel("Emoji")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(false)
                        .setPlaceholder('🔴');

                    modal.addComponents(
                        new ActionRowBuilder().addComponents(nameInput),
                        new ActionRowBuilder().addComponents(emojiInput)
                    );

                    await interaction.showModal(modal);
                    return;
                }

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('add_member_select_branch')
                    .setPlaceholder('Select a branch')
                    .addOptions(
                        branches.map(b => ({
                            label: b.name,
                            value: b.id.toString(),
                            emoji: b.emoji
                        }))
                    )
                    .addOptions({
                        label: '➕ Create New Branch',
                        value: 'new_branch',
                        emoji: '🆕'
                    });

                const row = new ActionRowBuilder().addComponents(selectMenu);
                
                await interaction.reply({
                    content: '**Step 1/3:** Select a branch or create a new one:',
                    components: [row],
                    ephemeral: true
                });
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
                
                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('manage_branches_select')
                    .setPlaceholder('Select action')
                    .addOptions([
                        { label: '➕ Create New Branch', value: 'create_branch', emoji: '🆕' },
                        ...branches.map(b => ({
                            label: `✏️ Edit ${b.name}`,
                            value: `edit_branch_${b.id}`,
                            emoji: b.emoji
                        })),
                        ...branches.map(b => ({
                            label: `🗑️ Delete ${b.name}`,
                            value: `delete_branch_${b.id}`,
                            emoji: '❌'
                        }))
                    ]);

                const row = new ActionRowBuilder().addComponents(selectMenu);
                
                await interaction.reply({
                    content: 'Manage Branches:',
                    components: [row],
                    ephemeral: true
                });
            }

            // MANAGE RANKS
            else if (interaction.customId === 'manage_ranks') {
                const branches = await db.getAllBranches();
                
                if (branches.length === 0) {
                    await interaction.reply({ 
                        content: '❌ No branches yet. Create a branch first!', 
                        ephemeral: true 
                    });
                    return;
                }

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('manage_ranks_select_branch')
                    .setPlaceholder('Select a branch')
                    .addOptions(
                        branches.map(b => ({
                            label: b.name,
                            value: b.id.toString(),
                            emoji: b.emoji
                        }))
                    );

                const row = new ActionRowBuilder().addComponents(selectMenu);
                
                await interaction.reply({
                    content: 'Select a branch to manage its ranks:',
                    components: [row],
                    ephemeral: true
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
                        .setLabel("Emoji")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(false)
                        .setPlaceholder('🔴');

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

                        await interaction.reply({
                            content: 'This branch has no ranks. Create the first one:',
                            ephemeral: true
                        });
                        await interaction.followUp({ embeds: [], components: [] });
                        await interaction.showModal(modal);
                        return;
                    }

                    const rankSelect = new StringSelectMenuBuilder()
                        .setCustomId('add_member_select_rank')
                        .setPlaceholder('Select a rank')
                        .addOptions(
                            ranks.map(r => ({
                                label: r.name,
                                value: r.id.toString()
                            }))
                        )
                        .addOptions({
                            label: '➕ Create New Rank',
                            value: 'new_rank',
                            emoji: '🆕'
                        });

                    const row = new ActionRowBuilder().addComponents(rankSelect);
                    
                    await interaction.update({
                        content: '**Step 2/3:** Select a rank or create a new one:',
                        components: [row]
                    });
                }
            }

            // ADD MEMBER - RANK SELECTION
            else if (interaction.customId === 'add_member_select_rank') {
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
                    
                    // Go straight to member details
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
                        .setLabel("Emoji")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(false)
                        .setPlaceholder('🔴');

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
                        .setLabel("Emoji")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(false)
                        .setValue(branch.emoji);

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
                                .setCustomId('cancel_delete')
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
                const branchId = parseInt(interaction.values[0]);
                const ranks = await db.getRanksByBranch(branchId);
                
                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId(`manage_ranks_select_action_${branchId}`)
                    .setPlaceholder('Select action')
                    .addOptions([
                        { label: '➕ Create New Rank', value: 'create_rank', emoji: '🆕' },
                        ...ranks.map(r => ({
                            label: `✏️ Edit ${r.name}`,
                            value: `edit_rank_${r.id}`
                        })),
                        ...ranks.map(r => ({
                            label: `🗑️ Delete ${r.name}`,
                            value: `delete_rank_${r.id}`
                        }))
                    ]);

                const row = new ActionRowBuilder().addComponents(selectMenu);
                
                await interaction.update({
                    content: 'Manage Ranks:',
                    components: [row]
                });
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
                                .setCustomId('cancel_delete')
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
                const name = interaction.fields.getTextInputValue('branch_name').toUpperCase();
                const emoji = interaction.fields.getTextInputValue('branch_emoji') || '📋';
                
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
                
                await interaction.reply({
                    content: `✅ Created branch **${name}**!\n\nNow create the first rank:`,
                    ephemeral: true
                });
                await interaction.showModal(modal);
            }

            // CREATE RANK DURING ADD MEMBER
            else if (interaction.customId === 'create_rank_for_member') {
                const rankName = interaction.fields.getTextInputValue('rank_name').toUpperCase();
                const userData = tempStore.get(interaction.user.id) || {};
                
                const rankId = await db.addRank(userData.branchId, rankName);
                userData.rankId = rankId;
                tempStore.set(interaction.user.id, userData);
                
                // Go to member details
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
                    .setLabel("Alt (Discord/Player)")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false);

                const titleInput = new TextInputBuilder()
                    .setCustomId('title')
                    .setLabel("Title/Role")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false);

                const notesInput = new TextInputBuilder()
                    .setCustomId('notes')
                    .setLabel("Notes")
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(false);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(nameInput),
                    new ActionRowBuilder().addComponents(altInput),
                    new ActionRowBuilder().addComponents(titleInput),
                    new ActionRowBuilder().addComponents(notesInput)
                );

                await interaction.reply({
                    content: `✅ Created rank **${rankName}**!\n\nNow add member details:`,
                    ephemeral: true
                });
                await interaction.showModal(modal);
            }

            // ADD MEMBER DETAILS
            else if (interaction.customId === 'add_member_details') {
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
                    null // subBranchId (can add later)
                );

                await updateBranchMessage(userData.branchId);
                
                tempStore.delete(interaction.user.id);
                
                await interaction.reply({
                    content: `✅ Successfully added **${name}** to the roster!`,
                    ephemeral: true
                });
            }

            // CREATE BRANCH (standalone)
            else if (interaction.customId === 'create_branch') {
                const name = interaction.fields.getTextInputValue('name').toUpperCase();
                const emoji = interaction.fields.getTextInputValue('emoji') || '📋';
                
                const branchId = await db.addBranch(name, emoji);
                await updateBranchMessage(branchId);
                
                await interaction.reply({
                    content: `✅ Created branch **${name}** ${emoji}`,
                    ephemeral: true
                });
            }

            // EDIT BRANCH
            else if (interaction.customId.startsWith('edit_branch_')) {
                const branchId = parseInt(interaction.customId.replace('edit_branch_', ''));
                const name = interaction.fields.getTextInputValue('name').toUpperCase();
                const emoji = interaction.fields.getTextInputValue('emoji') || '📋';
                
                await db.updateBranch(branchId, { name, emoji });
                await updateBranchMessage(branchId);
                
                await interaction.reply({
                    content: `✅ Updated branch to **${name}** ${emoji}`,
                    ephemeral: true
                });
            }

            // CREATE RANK (standalone)
            else if (interaction.customId.startsWith('create_rank_')) {
                const branchId = parseInt(interaction.customId.replace('create_rank_', ''));
                const name = interaction.fields.getTextInputValue('name').toUpperCase();
                
                await db.addRank(branchId, name);
                await updateBranchMessage(branchId);
                
                await interaction.reply({
                    content: `✅ Created rank **${name}**`,
                    ephemeral: true
                });
            }

            // EDIT RANK
            else if (interaction.customId.startsWith('edit_rank_')) {
                const rankId = parseInt(interaction.customId.replace('edit_rank_', ''));
                const name = interaction.fields.getTextInputValue('name').toUpperCase();
                
                // Get branch ID before updating
                const rank = await db.getRank(rankId);
                await db.updateRank(rankId, { name });
                await updateBranchMessage(rank.branch_id);
                
                await interaction.reply({
                    content: `✅ Updated rank to **${name}**`,
                    ephemeral: true
                });
            }

            // REMOVE MEMBER
            else if (interaction.customId === 'remove_member_modal') {
                const name = interaction.fields.getTextInputValue('member_name');
                
                // We need to find which branch this member was in to update it
                // This requires a new database method - for now, update all branches
                const changes = await db.removeCharacter(name);
                
                if (changes > 0) {
                    await updateAllBranchMessages();
                    await interaction.reply({
                        content: `✅ Removed **${name}** from roster`,
                        ephemeral: true
                    });
                } else {
                    await interaction.reply({
                        content: `❌ Could not find **${name}**`,
                        ephemeral: true
                    });
                }
            }
        }

        // ========== CONFIRMATION BUTTONS ==========
        else if (interaction.isButton()) {
            
            // CONFIRM DELETE BRANCH
            if (interaction.customId.startsWith('confirm_delete_branch_')) {
                const branchId = parseInt(interaction.customId.replace('confirm_delete_branch_', ''));
                const branch = await db.getBranch(branchId);
                
                await db.deleteBranch(branchId);
                
                // Try to delete the message
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

            // CANCEL DELETE
            else if (interaction.customId === 'cancel_delete') {
                await interaction.update({
                    content: '❌ Deletion cancelled',
                    components: []
                });
            }
        }
        
    } catch (error) {
        console.error('Interaction error:', error);
        await interaction.reply({ 
            content: '❌ An error occurred. Please try again.', 
            ephemeral: true 
        }).catch(() => {});
    }
});

client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
   console.log('📦 Initializing database...');
        await db.initialize();
        console.log('✅ Database initialized');
        
        // Step 2: Then run setup to ensure data exists
        console.log('📋 Checking roster data...');
        await init(db);  // Pass the db instance to setup
        console.log('✅ Setup complete');
    const channel = await client.channels.fetch(process.env.ROSTER_CHANNEL_ID);
    
    // Clear the channel (optional - be careful!)
    // const messages = await channel.messages.fetch();
    // await channel.bulkDelete(messages);
    
    await updateAllBranchMessages();
    await sendManagementPanel(channel);
});

// Command to show panel
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (message.content === '!panel' && message.member.permissions.has('ManageMessages')) {
        await sendManagementPanel(message.channel);
        message.delete();
    }
});

client.login(process.env.DISCORD_TOKEN);