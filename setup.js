// setup.js - Run this once to load your existing roster
const Database = require('./database.js');
const db = new Database();

async function setup() {
    console.log('🔄 Setting up initial roster...');

    // Clear existing data (optional - comment out if you want to keep existing)
    // await db.db.run('DELETE FROM characters');
    // await db.db.run('DELETE FROM ranks');
    // await db.db.run('DELETE FROM branches');

    // ===== ADD BRANCHES =====
    console.log('Adding branches...');
    const sithId = await db.addBranch('SITH ORDER', '🔴', 0);
    const isbId = await db.addBranch('IMPERIAL SECURITY BUREAU', '⚪', 1);
    const armyId = await db.addBranch('IMPERIAL ARMY', '🟢', 2);
    const navyId = await db.addBranch('IMPERIAL NAVY', '🔵',3);
    const mandoId = await db.addBranch('MANDALORIANS AND MERCENARIES', '🟤', 4);
    const civilId = await db.addBranch('CIVIL AFFAIRS', '🟣', 5);

    // ===== ADD RANKS =====
    console.log('Adding ranks...');
    
    // Sith Order ranks
    const sithRanks = {
        'DARTH': await db.addRank(sithId, 'DARTH', 0),
        'HIGH LORD': await db.addRank(sithId, 'HIGH LORD' ,1),
        'HONOUR GUARD': await db.addRank(sithId, 'HONOUR GUARD', 2),
        'SITH LORD': await db.addRank(sithId, 'SITH LORD', 3),
        'SITH': await db.addRank(sithId, 'SITH', 4),
        'SITH APPRENTICE': await db.addRank(sithId, 'SITH APPRENTICE', 5),
        'MASTERLESS SITH': await db.addRank(sithId, 'MASTERLESS SITH', 6),
        'ACOLYTE': await db.addRank(sithId, 'ACOLYTE', 7),
        'INITIATE': await db.addRank(sithId, 'INITIATE', 9),
        'ADDITIONAL': await db.addRank(sithId, 'ADDITIONAL', 10)
    };

    // ISB ranks
    const isbRanks = {
        'DIRECTOR': await db.addRank(isbId, 'DIRECTOR', 0),
        'MAJOR': await db.addRank(isbId, 'MAJOR', 1),
        'CAPTAIN': await db.addRank(isbId, 'CAPTAIN', 2),
        'LIEUTENANT': await db.addRank(isbId, 'LIEUTENANT', 3),
        'ENSIGN': await db.addRank(isbId, 'ENSIGN', 4)
    };

    // Army ranks
    const armyRanks = {
        'MAJOR': await db.addRank(armyId, 'MAJOR', 0),
        'CAPTAIN': await db.addRank(armyId, 'CAPTAIN', 1),
        'LIEUTENANT': await db.addRank(armyId, 'LIEUTENANT', 2),
        'ENSIGN': await db.addRank(armyId, 'ENSIGN', 3),
        'SERGEANT': await db.addRank(armyId, 'SERGEANT', 4),
        'CORPORAL': await db.addRank(armyId, 'CORPORAL', 5),
        'SPECIALIST': await db.addRank(armyId, 'SPECIALIST', 6),
        'PRIVATE': await db.addRank(armyId, 'PRIVATE', 7)
    };

    // Navy ranks
    const navyRanks = {
        'ADMIRAL': await db.addRank(navyId, 'ADMIRAL', 0),
        'COMMANDER': await db.addRank(navyId, 'COMMANDER', 1),
        'FLIGHT LIEUTENANT': await db.addRank(navyId, 'FLIGHT LIEUTENANT', 2),
        'MIDSHIPMAN': await db.addRank(navyId, 'MIDSHIPMAN', 3),
        'CORPORAL': await db.addRank(navyId, 'CORPORAL', 4),
        'PRIVATE': await db.addRank(navyId, 'PRIVATE', 5)
    };

    // Mando ranks
    const mandoRanks = {
        'MEMBER': await db.addRank(mandoId, 'MEMBER')
    };

    // Civil ranks
    const civilRanks = {
        'GOVERNOR': await db.addRank(civilId, 'GOVERNOR', 0),
        'ADMINISTRATOR': await db.addRank(civilId, 'ADMINISTRATOR', 1),
        'ATTENDANT': await db.addRank(civilId, 'ATTENDANT', 2),
        'ADDITIONAL': await db.addRank(civilId, 'ADDITIONAL', 3)
    };

    // ===== ADD SUB-BRANCHES =====
    console.log('Adding sub-branches...');
    

    // ISB sub-branches
    await db.addSubBranch(isbId, 'Internal Security Division');
    await db.addSubBranch(isbId, 'Surveillenace, Intelligence & Counter-Intelligence Division');
    
    // Navy sub-branches
    await db.addSubBranch(navyId, 'Talon Squadron');
    
    // Civil sub-branches
    await db.addSubBranch(civilId, 'Research Division');
    await db.addSubBranch(civilId, 'Diplomatic Corps');

    // ===== ADD CHARACTERS =====
    console.log('Adding characters...');

    // SITH ORDER characters

    await db.addCharacter(sithId, sithRanks['DARTH'], 'Ditâl Aesh\'murzan', 'Duskfell');
    await db.addCharacter(sithId, sithRanks['DARTH'], 'Draxos Azra', 'Nolan');
    await db.addCharacter(sithId, sithRanks['HIGH LORD'], 'Ariilia Haenor', 'Jin\'arr');
    await db.addCharacter(sithId, sithRanks['HONOUR GUARD'], 'Ja\'ell Aesh\'ulran', 'Vadar');
    await db.addCharacter(sithId, sithRanks['SITH LORD'], 'Halon Maen', 'Lennox');

    await db.addCharacter(sithId, sithRanks['SITH'], 'Qorvos Rist', 'Skipperstar');
    await db.addCharacter(sithId, sithRanks['SITH'], 'Ryangonja', 'Nomatter');
    await db.addCharacter(sithId, sithRanks['SITH'], 'Draven Exorius', 'Nolan');
    await db.addCharacter(sithId, sithRanks['SITH APPRENTICE'], 'Exsira', 'Wrathspire', 'App. to Draxos Azra');
    await db.addCharacter(sithId, sithRanks['SITH APPRENTICE'], 'Seva Morne', 'Katan', 'App. to Halon Maen');
    await db.addCharacter(sithId, sithRanks['SITH APPRENTICE'], 'Sazrena', 'Valksanderion', 'App. to Halon Maen');
    await db.addCharacter(sithId, sithRanks['SITH APPRENTICE'], 'Wortighern', 'Darkmatter', 'App. to Ditâl Aesh\'murzan');
    await db.addCharacter(sithId, sithRanks['SITH APPRENTICE'], 'Stellä Atanos', 'Skipperstar', 'App. to Lord Nuc\'lei');
    await db.addCharacter(sithId, sithRanks['SITH APPRENTICE'], 'Tyrriall', 'Ryder', 'App. to Ditâl Aesh\'murzan');
    await db.addCharacter(sithId, sithRanks['SITH APPRENTICE'], 'Peena Fralla', 'Narna', 'App. to Ditâl Aesh\'murzan');
    await db.addCharacter(sithId, sithRanks['SITH APPRENTICE'], 'Zarish', 'Tel\'dara', 'App. to Halon Maen');
    await db.addCharacter(sithId, sithRanks['MASTERLESS SITH'], 'Oren Mar', 'Lennox');
    await db.addCharacter(sithId, sithRanks['MASTERLESS SITH'], 'Che\'irar', 'Dawnsinger');
    await db.addCharacter(sithId, sithRanks['MASTERLESS SITH'], 'Peena Fralla', 'Narna');
    await db.addCharacter(sithId, sithRanks['MASTERLESS SITH'], 'Shróud', 'Dawnsinger');
    await db.addCharacter(sithId, sithRanks['MASTERLESS SITH'], 'Malgunn', 'Dunwall');
    await db.addCharacter(sithId, sithRanks['MASTERLESS SITH'], 'Lysandra Hegyn', 'Ishtarean');
    await db.addCharacter(sithId, sithRanks['MASTERLESS SITH'], 'Maerelle Ta\'kesh', 'Ignirathos');
    await db.addCharacter(sithId, sithRanks['MASTERLESS SITH'], 'Revna Norre', 'Heno');
    await db.addCharacter(sithId, sithRanks['MASTERLESS SITH'], 'Roko Exovar', 'Equinox');
    await db.addCharacter(sithId, sithRanks['ACOLYTE'], 'Ivéry', 'Crow');
    await db.addCharacter(sithId, sithRanks['ACOLYTE'], 'Avasar Sindar', 'Ithil');
    await db.addCharacter(sithId, sithRanks['ACOLYTE'], 'Jara Rai', 'Struggle');
    await db.addCharacter(sithId, sithRanks['ACOLYTE'], 'Kolsec', 'Beau-seant');
    await db.addCharacter(sithId, sithRanks['ACOLYTE'], 'Máv', 'Nezioti');
    await db.addCharacter(sithId, sithRanks['ACOLYTE'], 'Serin Lorne', 'Valarion');
    await db.addCharacter(sithId, sithRanks['ACOLYTE'], 'Sev Karrow', 'Korvayn');
    await db.addCharacter(sithId, sithRanks['ACOLYTE'], 'Sorien', 'Thalen');
    await db.addCharacter(sithId, sithRanks['ACOLYTE'], 'Tei\'leron', 'Nerox');
    await db.addCharacter(sithId, sithRanks['ACOLYTE'], 'Thunderir', 'Fatnaexotic');
    await db.addCharacter(sithId, sithRanks['ACOLYTE'], 'Vyndex', 'Forenia');
    await db.addCharacter(sithId, sithRanks['ACOLYTE'], 'Zodd Kaleth', 'Fighters');
    await db.addCharacter(sithId, sithRanks['ACOLYTE'], 'Ravena Vale', 'Ignirathos');
    await db.addCharacter(sithId, sithRanks['INITIATE'], 'Nohr Vess', 'Nomatter');
    await db.addCharacter(sithId, sithRanks['INITIATE'], 'Reneira Altis', 'Valerius');
    await db.addCharacter(sithId, sithRanks['ADDITIONAL'], 'Maris Valthana', 'Jin\'arr', 'Fallen Jedi');
    await db.addCharacter(sithId, sithRanks['ADDITIONAL'], 'Anurek Drakovel', 'Ignirathos', 'Fallen Jedi');
    await db.addCharacter(sithId, sithRanks['ADDITIONAL'], 'Alia Aesh\'murzan', 'Duskfell', 'Aesh\'murzan Keeper of Old');
console.log('✅ 1');
    // IMPERIAL SECURITY BUREAU characters
    const isbInternalId = (await db.getSubBranchesByBranch(isbId)).find(sb => sb.name === 'Internal Security Division')?.id;
    const isbIntelId = (await db.getSubBranchesByBranch(isbId)).find(sb => sb.name === 'Surveillenace, Intelligence & Counter-Intelligence Division')?.id;
console.log('✅ 2');
    await db.addCharacter(isbId, isbRanks['DIRECTOR'], 'Caligo Firefall', 'Duskfell');
    await db.addCharacter(isbId, isbRanks['MAJOR'], 'Jayeesha Lieja', 'Duskfell', 'Marshall', isbInternalId);
    await db.addCharacter(isbId, isbRanks['MAJOR'], 'Vurr\'gél', 'Lennox', 'Chief Supervisor',  isbInternalId);
    await db.addCharacter(isbId, isbRanks['LIEUTENANT'], 'Fabian Dekbruger', 'Vaksanderion', 'Agent',  isbInternalId);
    await db.addCharacter(isbId, isbRanks['LIEUTENANT'], 'Harul Daari', 'Hutt', 'Enforcer',  isbInternalId);
    await db.addCharacter(isbId, isbRanks['LIEUTENANT'], 'Gennari', 'Kaxani', 'Agent',  isbInternalId);
    await db.addCharacter(isbId, isbRanks['ENSIGN'], 'Horus Sabosen', 'Ren', 'Attendant',  isbInternalId);
    await db.addCharacter(isbId, isbRanks['MAJOR'], 'Obod Dand', 'Dand', 'Handler', isbIntelId);
    await db.addCharacter(isbId, isbRanks['CAPTAIN'], 'Aldran Veyron', 'Nolan', 'Loyalty Officer',  isbIntelId);
    await db.addCharacter(isbId, isbRanks['LIEUTENANT'], 'Irizi\'ra\'ven', 'Grin', 'Agent',  isbIntelId);
    await db.addCharacter(isbId, isbRanks['LIEUTENANT'], 'Rycus Warun', 'Primus', 'Agent',  isbIntelId);
    await db.addCharacter(isbId, isbRanks['LIEUTENANT'], 'Rif\'letik Joc\'exan', 'Rasczak', 'Fixer',  isbIntelId);
    await db.addCharacter(isbId, isbRanks['ENSIGN'], 'Arya Vex', 'Korvayn', 'Operative',  isbIntelId);
console.log('✅ 3');
    // IMPERIAL ARMY characters
    await db.addCharacter(armyId, armyRanks['MAJOR'], 'Daraxis Jen\'kaar', 'Jen\'kaar');
    await db.addCharacter(armyId, armyRanks['CAPTAIN'], 'Aatos Camirr', 'Ulmus');
    await db.addCharacter(armyId, armyRanks['LIEUTENANT'], 'Asha\'ia\'dazo', 'Selsiin');
    await db.addCharacter(armyId, armyRanks['LIEUTENANT'], 'Avalar Ush', 'Nolan');
    await db.addCharacter(armyId, armyRanks['LIEUTENANT'], 'Serbre', 'Trohan');
    await db.addCharacter(armyId, armyRanks['SERGEANT'], 'Droiken', 'Vicious');
    await db.addCharacter(armyId, armyRanks['CORPORAL'], 'Drehink Akaelif', 'Justmatt');
    await db.addCharacter(armyId, armyRanks['SPECIALIST'], 'Ben Jekk', 'Svict');
    await db.addCharacter(armyId, armyRanks['SPECIALIST'], 'Celestra Tyrus', 'Dokrathis');
    await db.addCharacter(armyId, armyRanks['SPECIALIST'], 'Rynysha Lidul', 'Jin\'arr');
console.log('✅ 4');
    // IMPERIAL NAVY characters
    const talonId = (await db.getSubBranchesByBranch(navyId)).find(sb => sb.name === 'Talon Squadron')?.id;

    await db.addCharacter(navyId, navyRanks['CORPORAL'], 'Camorus Briggs', 'Lennox');
    await db.addCharacter(navyId, navyRanks['PRIVATE'], 'Mavrik Vulran', 'Tel\'dara');
    await db.addCharacter(navyId, navyRanks['COMMANDER'], 'Livia Corde', 'Valerius', 'Talon-1',  talonId);
    await db.addCharacter(navyId, navyRanks['FLIGHT LIEUTENANT'], 'Xaelynn Solenne', 'Ignirathos', 'Talon-2',  talonId);
    await db.addCharacter(navyId, navyRanks['FLIGHT LIEUTENANT'], 'Athena Melode', 'Lennox', 'Talon-4',  talonId);
    await db.addCharacter(navyId, navyRanks['MIDSHIPMAN'], 'Egann', 'Frosthowl', 'Talon-3', talonId);
console.log('✅ 5');
    // MANDALORIANS AND MERCENARIES
    await db.addCharacter(mandoId, mandoRanks['MEMBER'], 'Corvus Fetch', 'Vaylic');
    await db.addCharacter(mandoId, mandoRanks['MEMBER'], 'Drayk Odran', 'Nolan');
    await db.addCharacter(mandoId, mandoRanks['MEMBER'], 'Hyd Viszla', 'Nolan');
    await db.addCharacter(mandoId, mandoRanks['MEMBER'], 'Jago Ryad', 'Ezelzhrik');
    await db.addCharacter(mandoId, mandoRanks['MEMBER'], 'Johno Baldus', 'Hadrium');
    await db.addCharacter(mandoId, mandoRanks['MEMBER'], 'Kel\'ulth Beroya', 'Lennox');
    await db.addCharacter(mandoId, mandoRanks['MEMBER'], 'Melfiars', 'Brothlork');
    await db.addCharacter(mandoId, mandoRanks['MEMBER'], 'Vaniele', 'Dawnsinger');
    await db.addCharacter(mandoId, mandoRanks['MEMBER'], 'Zhetia Chorn', 'Jin\'arr');
    await db.addCharacter(mandoId, mandoRanks['MEMBER'], 'Rax Kevar', 'Shadowhorn');
console.log('✅ 6');
    // CIVIL AFFAIRS
    const researchId = (await db.getSubBranchesByBranch(civilId)).find(sb => sb.name === 'Research Division')?.id;
    const diplomId = (await db.getSubBranchesByBranch(civilId)).find(sb => sb.name === 'Diplomatic Corps')?.id;

    await db.addCharacter(civilId, civilRanks['GOVERNOR'], 'Ampheon Ledas', 'Dand', 'Morabandar');
    await db.addCharacter(civilId, civilRanks['ADMINISTRATOR'], 'Lula Pom', '');
    await db.addCharacter(civilId, civilRanks['ATTENDANT'], 'Aradin Althiel', 'Nox');
    await db.addCharacter(civilId, civilRanks['ADDITIONAL'], 'Atha Roln', 'Jin\'arr', 'Doctor',  researchId);
    await db.addCharacter(civilId, civilRanks['ADDITIONAL'], 'Galen Greywind', 'Silver', 'Scientist',  researchId);
    await db.addCharacter(civilId, civilRanks['ADDITIONAL'], 'Ethan Corell', 'Fallenangel', 'Psychologist',  researchId);
    await db.addCharacter(civilId, civilRanks['ADDITIONAL'], 'Vianri Tolar ', 'Jin\'arr', 'Ensign',  diplomId);
 
    console.log('✅ Setup complete! All branches, ranks, and characters added.');
    console.log('🎉 You can now start the bot and it will show the full roster!');
}

setup().catch(console.error);