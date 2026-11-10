import ChatSocial from "./ChatSocial";
import { CallHistory, inviteCall } from "./ChatCallService";
import { hospitalApi } from "../../store/hospital";
import { api } from "../../store/api";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

/* ============================================================================ */
/*  TIPOS                                                                       */
/* ============================================================================ */
type Language = "pt" | "en" | "fr";

interface ChatSession {
  empresaId?: string;
  empresaNome?: string;
  funcionarioId?: string;
  funcionarioNome?: string;
  username?: string;
}

interface ChatAppProps {
  session?: ChatSession;
}

interface Chat {
  id: string;
  name: string;
  preview: string;
  time: string;
  unread: number;
  av: number;
  type: string;
  call?: boolean;
  phone?: string;
  description?: string;
  muted?: boolean;
  mutedUntil?: number;
  blocked?: boolean;
  participants?: string[];
  createdAt?: number;
  pinned?: boolean;
  hidden?: boolean;
  creator?: string;
  wallpaper?: string;
  bubbleColor?: string;
}

interface Message {
  id: string;
  text: string;
  type: "sent" | "received";
  time: string;
  timestamp: number;
  replyTo?: string;
  reactions?: Record<string, string[]>;
  edited?: boolean;
  deleted?: boolean;
  attachment?: { type: string; name: string; url: string; size: number };
  audio?: { url: string; duration: number };
  aiGenerated?: boolean;
  senderName?: string;
  read?: boolean;
}

interface Call {
  name: string;
  type: string;
  time: string;
  count?: number;
}

/* ============================================================================ */
/*  TRADUÇÕES (PT / EN / FR)                                                    */
/* ============================================================================ */
const TRANSLATIONS: Record<
  Language,
  Record<string, string | string[] | Record<string, string>>
> = {
  pt: {
    appName: "NV-DIGITAL Chat",
    tagline: "Comunicação Interna",
    conversations: "Conversas",
    calls: "Chamadas",
    status: "Estados",
    channels: "Canais",
    communities: "Comunidades",
    metaAI: "Assistente IA",
    profile: "Perfil",
    newConversation: "Nova conversa",
    newGroup: "Novo grupo",
    searchPlaceholder: "Procurar ou criar uma nova conversa",
    searchCallsPlaceholder: "Procurar nome ou número",
    clear: "Limpar",
    all: "Tudo",
    unread: "Não lidas",
    favorites: "Favoritos",
    groups: "Grupos",
    archived: "Arquivadas",
    archivedEmpty: "O HTML fornecido não contém conversas arquivadas.",
    recent: "Recentes",
    noResults: "Nenhuma conversa encontrada.",
    noCalls: "Nenhuma chamada encontrada.",
    e2eMessage: "Histórico guardado no servidor da instituição.",
    chatApp: "Chat da App",
    chatAppSubtitle: "Seleccione uma conversa para começar.",
    back: "Voltar",
    videoCall: "Chamada de vídeo",
    voiceCall: "Chamada de voz",
    statistics: "Estatísticas",
    searchInChat: "Pesquisar na conversa",
    moreOptions: "Mais opções",
    viewContact: "Ver contacto",
    muteNotifications: "Silenciar notificações",
    unmuteNotifications: "Ativar notificações",
    wallpaper: "Papel de parede",
    mediaGallery: "Galeria de mídia",
    clearMessages: "Limpar mensagens",
    deleteConversation: "Eliminar conversa",
    help: "Ajuda",
    contactData: "Dados do contacto",
    info: "Info",
    mobile: "Telemóvel",
    chatType: "Tipo de conversa",
    individual: "Individual",
    group: "Grupo",
    lastActivity: "Última atividade",
    mediaLinksDocs: "Mídia, links e docs",
    media: "Mídia",
    documents: "Documentos",
    links: "Links",
    participants: "participantes",
    groupCreator: "Criador do grupo",
    member: "Membro",
    muted: "Silenciado",
    blocked: "Bloqueado",
    blockContact: "Bloquear contacto",
    unblockContact: "Desbloquear contacto",
    wallpaperTitle: "Papel de parede",
    wallpaperInfo: "Personalize o fundo e a cor das mensagens desta conversa.",
    bubbleColor: "Cor das mensagens enviadas",
    bubbleDefault: "Cor padrão",
    bubbleAllChats: "Usar esta cor como padrão nas outras conversas",
    applyingTo: "A aplicar a",
    colors: "Cores",
    patterns: "Padrões",
    myPhotos: "Meus",
    solidColors: "Cores sólidas",
    gradients: "Gradientes",
    chooseImage: "Escolher imagem",
    myPhotosTitle: "As minhas fotos",
    myPhotosDesc:
      "Escolha uma imagem da sua galeria para usar como papel de parede desta conversa.",
    restoreDefault: "Restaurar padrão",
    done: "Concluir",
    tip: "Dica",
    tipText:
      "Os padrões são otimizados para leitura. Cores claras funcionam melhor com texto escuro.",
    writeMessage: "Escreva uma mensagem",
    replyTo: "Responder a",
    yourself: "você mesmo",
    editingMessage: "Editando mensagem",
    recording: "Gravando...",
    send: "Enviar",
    emoji: "Emoji",
    searchEmoji: "Pesquisar emoji...",
    emojis: "emojis",
    clickToInsert: "Clique para inserir",
    noEmojiFound: "Nenhum emoji encontrado",
    copy: "Copiar",
    reply: "Responder",
    forward: "Encaminhar",
    edit: "Editar",
    delete: "Eliminar",
    react: "Reagir",
    messageCopied: "Mensagem copiada",
    messageDeleted: "Mensagem eliminada",
    messagesCleared: "Mensagens limpas",
    conversationDeleted: "Conversa eliminada",
    wallpaperApplied: "Papel de parede aplicado!",
    wallpaperRestored: "Papel de parede restaurado ao padrão",
    mutedFor: "Conversa silenciada por",
    notificationsEnabled: "Notificações ativadas",
    contactBlocked: "Contacto bloqueado",
    contactUnblocked: "Contacto desbloqueado",
    muteTitle: "Silenciar notificações",
    muteDesc: "Escolha por quanto tempo deseja silenciar",
    hours8: "8 horas",
    week1: "1 semana",
    year1: "1 ano",
    forever: "Sempre",
    cancel: "Cancelar",
    createGroup: "Criar Novo Grupo",
    groupName: "Nome do Grupo",
    participantsLabel: "Participantes",
    selected: "selecionados",
    create: "Criar",
    groupCreated: "Grupo criado com sucesso!",
    groupNameRequired:
      "Nome do grupo e pelo menos 1 participante são obrigatórios",
    newChatLocal: "Nova conversa",
    contactName: "Nome do contacto",
    contactNamePlaceholder: "Digite o nome do contacto",
    sessionOnly:
      "Seleccione um funcionário da instituição. O histórico fica guardado na base de dados.",
    aiNotAvailable: "Chat IA não disponível",
    aiAssistant: "Assistente Inteligente",
    callsRequireService:
      "Chamadas reais requerem ligação a um serviço de chamadas.",
    cameraRequiresService: "A câmera requer ligação ao servidor.",
    attachmentRequiresService: "O envio de anexos requer ligação ao servidor.",
    locationRequiresService: "A localização requer ligação ao servidor.",
    contactRequiresService: "Partilhar contacto requer ligação ao servidor.",
    documentRequiresService:
      "O envio de documentos requer ligação ao servidor.",
    audioRequiresService: "Gravação de áudio requer ligação ao servidor.",
    imageSelectionRequiresService:
      "Seleção de imagem requer ligação ao servidor.",
    helpText: "Ajuda: Use Ctrl+K para pesquisar",
    action: "Ação",
    videoCallStarted: "Chamada de vídeo iniciada",
    voiceCallStarted: "Chamada de voz iniciada",
    callEnded: "Chamada terminada",
    cameraMicError: "Erro ao aceder à câmera/microfone",
    micError: "Erro ao aceder ao microfone",
    recordingStarted: "Gravação iniciada",
    recordingFinished: "Gravação finalizada",
    audioSent: "Áudio enviado",
    voiceMessage: "🎵 Mensagem de voz",
    fileLoaded: "Ficheiro carregado",
    notificationsNotSupported: "Notificações não suportadas neste navegador",
    notificationsGranted: "Notificações ativadas!",
    notificationsDenied: "Permissão de notificações negada",
    statisticsTitle: "Estatísticas da Conversa",
    total: "Total",
    sent: "Enviadas",
    received: "Recebidas",
    ai: "IA",
    distribution: "Distribuição",
    messagesPerDay: "Mensagens por dia",
    topEmojis: "Top Emojis",
    noEmojisUsed: "Nenhum emoji usado ainda.",
    withAttachments: "Com anexos",
    withAudio: "Com áudio",
    noMediaShared: "Nenhuma mídia partilhada nesta conversa.",
    forwardTitle: "Encaminhar mensagem",
    messageToForward: "Mensagem a encaminhar",
    selectConversation: "Selecione uma conversa para encaminhar esta mensagem.",
    forwardSuccess: "Mensagem encaminhada com sucesso!",
    close: "Fechar",
    language: "Idioma",
    theme: "Tema",
    dark: "Escuro",
    light: "Claro",
    online: "Online",
    privateGroup: "Grupo privado",
    privateContact: "Contacto privado",
    edited: "editada",
    deletedMessage: " Mensagem eliminada",
    aiBadge: "Assistente IA",
    aiGreeting: "Olá! Sou o assistente IA",
    groupCreatedMessage: "Grupo criado",
    you: "Você",
    languagePT: "Português",
    languageEN: "English",
    languageFR: "Français",
    selectLanguage: "Selecionar idioma",
    dayNames: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],
    frequent: "Frequentes",
    smileys: "Rostos",
    gestures: "Gestos",
    hearts: "Corações",
    animals: "Animais",
    food: "Comida",
    activities: "Atividades",
    objects: "Objetos",
    flags: "Bandeiras",
    symbols: "Símbolos",
    wallpaperNames: {
      default: "Padrão",
      white: "Branco",
      cream: "Creme",
      gray: "Cinza Claro",
      blue: "Azul Claro",
      green: "Verde Claro",
      yellow: "Amarelo Claro",
      pink: "Rosa Claro",
      purple: "Roxo Claro",
      sunset: "Pôr do Sol",
      ocean: "Oceano",
      forest: "Floresta",
      rose: "Rosa",
      night: "Noite",
      peach: "Pêssego",
      mint: "Menta",
      dots: "Pontos",
      lines: "Linhas",
      circles: "Círculos",
    },
  },
  en: {
    appName: "NV-DIGITAL Chat",
    tagline: "Internal Communication",
    conversations: "Chats",
    calls: "Calls",
    status: "Status",
    channels: "Channels",
    communities: "Communities",
    metaAI: "Assistente IA",
    profile: "Profile",
    newConversation: "New chat",
    newGroup: "New group",
    searchPlaceholder: "Search or start new chat",
    searchCallsPlaceholder: "Search name or number",
    clear: "Clear",
    all: "All",
    unread: "Unread",
    favorites: "Favorites",
    groups: "Groups",
    archived: "Archived",
    archivedEmpty: "The provided HTML does not contain archived chats.",
    recent: "Recent",
    noResults: "No chats found.",
    noCalls: "No calls found.",
    e2eMessage: "History stored on the institution server.",
    chatApp: "Chat App",
    chatAppSubtitle: "Select a chat to start messaging.",
    back: "Back",
    videoCall: "Video call",
    voiceCall: "Voice call",
    statistics: "Statistics",
    searchInChat: "Search in chat",
    moreOptions: "More options",
    viewContact: "View contact",
    muteNotifications: "Mute notifications",
    unmuteNotifications: "Unmute notifications",
    wallpaper: "Wallpaper",
    mediaGallery: "Media gallery",
    clearMessages: "Clear messages",
    deleteConversation: "Delete chat",
    help: "Help",
    contactData: "Contact info",
    info: "Info",
    mobile: "Mobile",
    chatType: "Chat type",
    individual: "Individual",
    group: "Group",
    lastActivity: "Last activity",
    mediaLinksDocs: "Media, links and docs",
    media: "Media",
    documents: "Documents",
    links: "Links",
    participants: "participants",
    groupCreator: "Group creator",
    member: "Member",
    muted: "Muted",
    blocked: "Blocked",
    blockContact: "Block contact",
    unblockContact: "Unblock contact",
    wallpaperTitle: "Wallpaper",
    wallpaperInfo: "Personalize the wallpaper and message color for this chat.",
    bubbleColor: "Sent message color",
    bubbleDefault: "Default color",
    bubbleAllChats: "Use this color as default in other chats",
    applyingTo: "Applying to",
    colors: "Colors",
    patterns: "Patterns",
    myPhotos: "Mine",
    solidColors: "Solid colors",
    gradients: "Gradients",
    chooseImage: "Choose image",
    myPhotosTitle: "My photos",
    myPhotosDesc:
      "Choose an image from your gallery to use as wallpaper for this chat.",
    restoreDefault: "Restore default",
    done: "Done",
    tip: "Tip",
    tipText:
      "Patterns are optimized for readability. Light colors work best with dark text.",
    writeMessage: "Type a message",
    replyTo: "Replying to",
    yourself: "yourself",
    editingMessage: "Editing message",
    recording: "Recording...",
    send: "Send",
    emoji: "Emoji",
    searchEmoji: "Search emoji...",
    emojis: "emojis",
    clickToInsert: "Click to insert",
    noEmojiFound: "No emoji found",
    copy: "Copy",
    reply: "Reply",
    forward: "Forward",
    edit: "Edit",
    delete: "Delete",
    react: "React",
    messageCopied: "Message copied",
    messageDeleted: "Message deleted",
    messagesCleared: "Messages cleared",
    conversationDeleted: "Chat deleted",
    wallpaperApplied: "Wallpaper applied!",
    wallpaperRestored: "Wallpaper restored to default",
    mutedFor: "Chat muted for",
    notificationsEnabled: "Notifications enabled",
    contactBlocked: "Contact blocked",
    contactUnblocked: "Contact unblocked",
    muteTitle: "Mute notifications",
    muteDesc: "Choose how long to mute",
    hours8: "8 hours",
    week1: "1 week",
    year1: "1 year",
    forever: "Always",
    cancel: "Cancel",
    createGroup: "Create New Group",
    groupName: "Group name",
    participantsLabel: "Participants",
    selected: "selected",
    create: "Create",
    groupCreated: "Group created successfully!",
    groupNameRequired: "Group name and at least 1 participant are required",
    newChatLocal: "New chat",
    contactName: "Contact name",
    contactNamePlaceholder: "Type contact name",
    sessionOnly:
      "Choose an institution contact. History is stored in the database.",
    aiNotAvailable: "AI chat not available",
    aiAssistant: "Smart Assistant",
    callsRequireService: "Real calls require a calling service connection.",
    cameraRequiresService: "Camera requires server connection.",
    attachmentRequiresService:
      "Sending attachments requires server connection.",
    locationRequiresService: "Location requires server connection.",
    contactRequiresService: "Sharing contact requires server connection.",
    documentRequiresService: "Sending documents requires server connection.",
    audioRequiresService: "Audio recording requires server connection.",
    imageSelectionRequiresService:
      "Image selection requires server connection.",
    helpText: "Help: Use Ctrl+K to search",
    action: "Action",
    videoCallStarted: "Video call started",
    voiceCallStarted: "Voice call started",
    callEnded: "Call ended",
    cameraMicError: "Error accessing camera/microphone",
    micError: "Error accessing microphone",
    recordingStarted: "Recording started",
    recordingFinished: "Recording finished",
    audioSent: "Audio sent",
    voiceMessage: "🎵 Voice message",
    fileLoaded: "File loaded",
    notificationsNotSupported: "Notifications not supported in this browser",
    notificationsGranted: "Notifications enabled!",
    notificationsDenied: "Notification permission denied",
    statisticsTitle: "Chat Statistics",
    total: "Total",
    sent: "Sent",
    received: "Received",
    ai: "AI",
    distribution: "Distribution",
    messagesPerDay: "Messages per day",
    topEmojis: "Top Emojis",
    noEmojisUsed: "No emojis used yet.",
    withAttachments: "With attachments",
    withAudio: "With audio",
    noMediaShared: "No media shared in this chat.",
    forwardTitle: "Forward message",
    messageToForward: "Message to forward",
    selectConversation: "Select a chat to forward this message.",
    forwardSuccess: "Message forwarded successfully!",
    close: "Close",
    language: "Language",
    theme: "Theme",
    dark: "Dark",
    light: "Light",
    online: "Online",
    privateGroup: "Private group",
    privateContact: "Private contact",
    edited: "edited",
    deletedMessage: "🚫 Message deleted",
    aiBadge: "Assistente IA",
    aiGreeting: "Hello! I'm the AI assistant",
    groupCreatedMessage: "Group created",
    you: "You",
    languagePT: "Português",
    languageEN: "English",
    languageFR: "Français",
    selectLanguage: "Select language",
    dayNames: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    frequent: "Frequent",
    smileys: "Smileys",
    gestures: "Gestures",
    hearts: "Hearts",
    animals: "Animals",
    food: "Food",
    activities: "Activities",
    objects: "Objects",
    flags: "Flags",
    symbols: "Symbols",
    wallpaperNames: {
      default: "Default",
      white: "White",
      cream: "Cream",
      gray: "Light Gray",
      blue: "Light Blue",
      green: "Light Green",
      yellow: "Light Yellow",
      pink: "Light Pink",
      purple: "Light Purple",
      sunset: "Sunset",
      ocean: "Ocean",
      forest: "Forest",
      rose: "Rose",
      night: "Night",
      peach: "Peach",
      mint: "Mint",
      dots: "Dots",
      lines: "Lines",
      circles: "Circles",
    },
  },
  fr: {
    appName: "NV-DIGITAL Chat",
    tagline: "Communication Interne",
    conversations: "Discussions",
    calls: "Appels",
    status: "Statuts",
    channels: "Canaux",
    communities: "Communautés",
    metaAI: "Meta IA",
    profile: "Profil",
    newConversation: "Nouvelle discussion",
    newGroup: "Nouveau groupe",
    searchPlaceholder: "Rechercher ou démarrer une discussion",
    searchCallsPlaceholder: "Rechercher nom ou numéro",
    clear: "Effacer",
    all: "Tout",
    unread: "Non lus",
    favorites: "Favoris",
    groups: "Groupes",
    archived: "Archivées",
    archivedEmpty: "Le HTML fourni ne contient pas de discussions archivées.",
    recent: "Récentes",
    noResults: "Aucune discussion trouvée.",
    noCalls: "Aucun appel trouvé.",
    e2eMessage: "Historique enregistré sur le serveur de votre établissement.",
    chatApp: "App de Chat",
    chatAppSubtitle: "Sélectionnez une discussion pour commencer.",
    back: "Retour",
    videoCall: "Appel vidéo",
    voiceCall: "Appel vocal",
    statistics: "Statistiques",
    searchInChat: "Rechercher dans la discussion",
    moreOptions: "Plus d'options",
    viewContact: "Voir le contact",
    muteNotifications: "Couper les notifications",
    unmuteNotifications: "Activer les notifications",
    wallpaper: "Fond d'écran",
    mediaGallery: "Galerie média",
    clearMessages: "Effacer les messages",
    deleteConversation: "Supprimer la discussion",
    help: "Aide",
    contactData: "Infos du contact",
    info: "Infos",
    mobile: "Mobile",
    chatType: "Type de discussion",
    individual: "Individuelle",
    group: "Groupe",
    lastActivity: "Dernière activité",
    mediaLinksDocs: "Médias, liens et docs",
    media: "Médias",
    documents: "Documents",
    links: "Liens",
    participants: "participants",
    groupCreator: "Créateur du groupe",
    member: "Membre",
    muted: "Muet",
    blocked: "Bloqué",
    blockContact: "Bloquer le contact",
    unblockContact: "Débloquer le contact",
    wallpaperTitle: "Fond d'écran",
    wallpaperInfo:
      "Personnalisez le fond d'écran et la couleur des messages de cette discussion.",
    bubbleColor: "Couleur des messages envoyés",
    bubbleDefault: "Couleur par défaut",
    bubbleAllChats: "Utiliser cette couleur par défaut dans les autres discussions",
    applyingTo: "Appliquer à",
    colors: "Couleurs",
    patterns: "Motifs",
    myPhotos: "Miennes",
    solidColors: "Couleurs unies",
    gradients: "Dégradés",
    chooseImage: "Choisir une image",
    myPhotosTitle: "Mes photos",
    myPhotosDesc:
      "Choisissez une image de votre galerie comme fond d'écran pour cette discussion.",
    restoreDefault: "Restaurer par défaut",
    done: "Terminé",
    tip: "Astuce",
    tipText:
      "Les motifs sont optimisés pour la lisibilité. Les couleurs claires fonctionnent mieux avec du texte sombre.",
    writeMessage: "Écrivez un message",
    replyTo: "Répondre à",
    yourself: "vous-même",
    editingMessage: "Modification du message",
    recording: "Enregistrement...",
    send: "Envoyer",
    emoji: "Emoji",
    searchEmoji: "Rechercher emoji...",
    emojis: "emojis",
    clickToInsert: "Cliquez pour insérer",
    noEmojiFound: "Aucun emoji trouvé",
    copy: "Copier",
    reply: "Répondre",
    forward: "Transférer",
    edit: "Modifier",
    delete: "Supprimer",
    react: "Réagir",
    messageCopied: "Message copié",
    messageDeleted: "Message supprimé",
    messagesCleared: "Messages effacés",
    conversationDeleted: "Discussion supprimée",
    wallpaperApplied: "Fond d'écran appliqué !",
    wallpaperRestored: "Fond d'écran restauré par défaut",
    mutedFor: "Discussion coupée pour",
    notificationsEnabled: "Notifications activées",
    contactBlocked: "Contact bloqué",
    contactUnblocked: "Contact débloqué",
    muteTitle: "Couper les notifications",
    muteDesc: "Choisissez la durée de coupure",
    hours8: "8 heures",
    week1: "1 semaine",
    year1: "1 an",
    forever: "Toujours",
    cancel: "Annuler",
    createGroup: "Créer un Nouveau Groupe",
    groupName: "Nom du groupe",
    participantsLabel: "Participants",
    selected: "sélectionnés",
    create: "Créer",
    groupCreated: "Groupe créé avec succès !",
    groupNameRequired: "Le nom du groupe et au moins 1 participant sont requis",
    newChatLocal: "Nouvelle discussion",
    contactName: "Nom du contact",
    contactNamePlaceholder: "Tapez le nom du contact",
    sessionOnly:
      "Choisissez un contact de votre établissement. Les messages sont enregistrés en base de données.",
    aiNotAvailable: "Chat IA non disponible",
    aiAssistant: "Assistant Intelligent",
    callsRequireService:
      "Les vrais appels nécessitent une connexion à un service d'appels.",
    cameraRequiresService: "La caméra nécessite une connexion au serveur.",
    attachmentRequiresService:
      "L'envoi de pièces jointes nécessite une connexion au serveur.",
    locationRequiresService:
      "La localisation nécessite une connexion au serveur.",
    contactRequiresService:
      "Le partage de contact nécessite une connexion au serveur.",
    documentRequiresService:
      "L'envoi de documents nécessite une connexion au serveur.",
    audioRequiresService:
      "L'enregistrement audio nécessite une connexion au serveur.",
    imageSelectionRequiresService:
      "La sélection d'image nécessite une connexion au serveur.",
    helpText: "Aide : Utilisez Ctrl+K pour rechercher",
    action: "Action",
    videoCallStarted: "Appel vidéo démarré",
    voiceCallStarted: "Appel vocal démarré",
    callEnded: "Appel terminé",
    cameraMicError: "Erreur d'accès à la caméra/microphone",
    micError: "Erreur d'accès au microphone",
    recordingStarted: "Enregistrement démarré",
    recordingFinished: "Enregistrement terminé",
    audioSent: "Audio envoyé",
    voiceMessage: "🎵 Message vocal",
    fileLoaded: "Fichier chargé",
    notificationsNotSupported:
      "Notifications non supportées dans ce navigateur",
    notificationsGranted: "Notifications activées !",
    notificationsDenied: "Permission de notifications refusée",
    statisticsTitle: "Statistiques de la Discussion",
    total: "Total",
    sent: "Envoyés",
    received: "Reçus",
    ai: "IA",
    distribution: "Distribution",
    messagesPerDay: "Messages par jour",
    topEmojis: "Top Emojis",
    noEmojisUsed: "Aucun emoji utilisé pour le moment.",
    withAttachments: "Avec pièces jointes",
    withAudio: "Avec audio",
    noMediaShared: "Aucun média partagé dans cette discussion.",
    forwardTitle: "Transférer le message",
    messageToForward: "Message à transférer",
    selectConversation:
      "Sélectionnez une discussion pour transférer ce message.",
    forwardSuccess: "Message transféré avec succès !",
    close: "Fermer",
    language: "Langue",
    theme: "Thème",
    dark: "Sombre",
    light: "Clair",
    online: "En ligne",
    privateGroup: "Groupe privé",
    privateContact: "Contact privé",
    edited: "modifié",
    deletedMessage: "🚫 Message supprimé",
    aiBadge: "Meta IA",
    aiGreeting: "Bonjour ! Je suis l'assistant IA",
    groupCreatedMessage: "Groupe créé",
    you: "Vous",
    languagePT: "Português",
    languageEN: "English",
    languageFR: "Français",
    selectLanguage: "Sélectionner la langue",
    dayNames: ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"],
    frequent: "Fréquents",
    smileys: "Émoticônes",
    gestures: "Gestes",
    hearts: "Cœurs",
    animals: "Animaux",
    food: "Nourriture",
    activities: "Activités",
    objects: "Objets",
    flags: "Drapeaux",
    symbols: "Symboles",
    wallpaperNames: {
      default: "Défaut",
      white: "Blanc",
      cream: "Crème",
      gray: "Gris Clair",
      blue: "Bleu Clair",
      green: "Vert Clair",
      yellow: "Jaune Clair",
      pink: "Rose Clair",
      purple: "Violet Clair",
      sunset: "Coucher de Soleil",
      ocean: "Océan",
      forest: "Forêt",
      rose: "Rose",
      night: "Nuit",
      peach: "Pêche",
      mint: "Menthe",
      dots: "Points",
      lines: "Lignes",
      circles: "Cercles",
    },
  },
};

/* ============================================================================ */
/*  ÍCONES SVG                                                                  */
/* ============================================================================ */
const Icon = {
  WhatsApp: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.5 14.4c-.3-.1-1.7-.8-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4 0 1.4 1 2.8 1.2 3 .1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3zM12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.3 5L2 22l5.2-1.4c1.5.8 3.1 1.2 4.8 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2z" />
    </svg>
  ),
  Chat: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19.08 3H4.92C3.31 3 2 4.31 2 5.92v12.16c0 1.61 1.31 2.92 2.92 2.92H8l4 3 4-3h3.08c1.61 0 2.92-1.31 2.92-2.92V5.92C22 4.31 20.69 3 19.08 3zM8 11a1 1 0 011-1h9a1 1 0 110 2H9a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 110 2H9a1 1 0 01-1-1z" />
    </svg>
  ),
  Phone: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19.95 21c-2.08 0-4.14-.45-6.17-1.36a18.3 18.3 0 01-5.55-3.87 18.47 18.47 0 01-3.87-5.54C3.46 8.18 3 6.13 3 4.04A1.02 1.02 0 014.05 3H8.1c.23 0 .44.08.63.24a.9.9 0 01.32.56l.65 3.5c.03.27.03.5-.02.67-.05.19-.15.35-.28.48L6.97 10.9c.34.62.73 1.21 1.2 1.79.45.57.96 1.13 1.5 1.66A17.59 17.59 0 0013.1 17l2.35-2.35a1.61 1.61 0 011.3-.4l3.45.7c.23.07.43.19.57.36.16.18.23.37.23.59v4.05A1.02 1.02 0 0119.95 21z" />
    </svg>
  ),
  Status: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M13.56 3.14c.1-.55.62-.92 1.15-.77a10 10 0 016.98 12.1.91.91 0 01-1.23.6c-.52-.18-.78-.75-.66-1.3a8 8 0 00-5.44-9.41c-.53-.17-.9-.68-.8-1.22zm5.34 14.65c.42.35.48.98.08 1.37a10 10 0 01-13.96 0c-.4-.39-.34-1.02.08-1.38a1.11 1.11 0 011.46.09 8 8 0 0010.88 0c.4-.38 1.03-.44 1.45-.09zM3.54 15.08c-.52.19-1.1-.08-1.23-.62A10 10 0 019.29 2.37c.53-.15 1.05.22 1.15.77.1.54-.27 1.05-.8 1.22a8 8 0 00-5.44 9.42c.12.54-.14 1.1-.66 1.3z" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  ),
  Channel: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15.83 8.63A1 1 0 0117.2 9a5.98 5.98 0 010 6 1 1 0 01-1.73-1 3.98 3.98 0 000-4 1 1 0 01.36-1.37zm-7.66 0A1 1 0 018.53 10a3.98 3.98 0 000 4 1 1 0 01-1.73 1 5.98 5.98 0 010-6 1 1 0 011.37-.37z" />
      <circle cx="12" cy="12" r="1.5" />
      <path d="m5.33 16.48-.23.8c-.24.77-.48 1.6-.68 2.3.7-.2 1.53-.44 2.3-.68l.8-.23.72.39a8 8 0 10-3.3-3.3l.4.72z" />
    </svg>
  ),
  Community: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6.37 18.67a1.81 1.81 0 01-.58-1.24c-.01-.5-.03-1.5.03-1.94a2.7 2.7 0 01.4-1.1 2.84 2.84 0 01.9-.82c.46-.28.98-.46 1.4-.58A12.2 12.2 0 0112 12.5a12.69 12.69 0 013.47.49 5.76 5.76 0 011.52.65c.28.19.56.44.78.76a2.41 2.41 0 01.41 1.1c.06.43.04 1.43.03 1.93a1.9 1.9 0 01-.58 1.24c-.22.2-.48.33-.75.33H7.12c-.27 0-.53-.13-.75-.33z" />
      <circle cx="12" cy="6" r="1.55" />
      <path d="M14.9 9.62A3.54 3.54 0 0015.5 7a3.56 3.56 0 10-.61 2.62zm-7.88.4a2.67 2.67 0 10-5.16-1.38 2.67 2.67 0 005.16 1.38z" />
    </svg>
  ),
  Sparkles: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" />
      <path d="M19 15l.75 2.25L22 18l-2.25.75L19 21l-.75-2.25L16 18l2.25-.75z" />
    </svg>
  ),
  Plus: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19.08 3H4.92C3.31 3 2 4.31 2 5.92v12.16c0 1.61 1.31 2.92 2.92 2.92H8l4 3 4-3h3.08c1.61 0 2.92-1.31 2.92-2.92V5.92C22 4.31 20.69 3 19.08 3zM12 11V7h-2v4H6v2h4v4h2v-4h4v-2h-4z" />
    </svg>
  ),
  Search: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
    </svg>
  ),
  X: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
    </svg>
  ),
  Archive: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5L6.5 12H10v-2h4v2h3.5L12 17.5zM5.12 5l.81-1h12l.94 1H5.12z" />
    </svg>
  ),
  ArrowLeft: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
    </svg>
  ),
  Video: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15.99 14.26c-.01-.08-.02-.16-.02-.26 0-.94.39-1.81 1.01-2.49l-3.26-2.35c-.27.13-.57.2-.87.2-.31 0-.6-.08-.87-.2l-3.26 2.35c.62.68 1.01 1.55 1.01 2.49 0 .1-.01.18-.02.26l3.14 2.26 3.14-2.26zM17.5 3C16.12 3 15 4.12 15 5.5V6h-2V5.5C13 4.12 11.88 3 10.5 3S8 4.12 8 5.5V6H6V5.5C6 4.12 4.88 3 3.5 3S1 4.12 1 5.5V18c0 1.66 1.34 3 3 3h16c1.66 0 3-1.34 3-3V5.5c0-1.38-1.12-2.5-2.5-2.5S18 4.12 18 5.5V6h-2V5.5c0-1.38-1.12-2.5-2.5-2.5z" />
    </svg>
  ),
  Smile: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
    </svg>
  ),
  Paperclip: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1.816 15.556v.002c0 1.502.584 2.912 1.646 3.972s2.472 1.647 3.974 1.647a5.58 5.58 0 003.972-1.645l9.547-9.548c.769-.768 1.147-1.767 1.058-2.817-.079-.968-.548-1.927-1.319-2.698-1.594-1.592-4.068-1.711-5.517-.262l-7.916 7.915c-.881.881-.792 2.25.214 3.261.959.958 2.423 1.053 3.263.215l5.511-5.512c.28-.28.267-.722.053-.936l-.244-.244c-.191-.191-.567-.349-.957.04l-5.506 5.506c-.18.18-.635.127-.976-.214-.098-.097-.576-.613-.213-.973l7.915-7.917c.818-.817 2.267-.231 2.694.195.271.271.436.64.474.98.041.399-.121.737-.446 1.061l-9.546 9.549a3.97 3.97 0 01-2.829 1.171 3.975 3.975 0 01-2.83-1.171 3.973 3.973 0 01-1.172-2.828c0-1.071.415-2.076 1.172-2.83l7.209-7.211c.157-.157.264-.579.028-.814L11.5 4.36a.572.572 0 00-.834.018l-7.205 7.207a5.577 5.577 0 00-1.645 3.971z" />
    </svg>
  ),
  Send: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  ),
  Lock: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  ),
  Camera: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  ),
  Mic: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
      <path d="M19 10v2a7 7 0 01-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  ),
  MapPin: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  Contact: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  File: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  MoreVertical: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  ),
  PhoneIncoming: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="16 2 16 8 22 8" />
      <line x1="23" y1="1" x2="16" y2="8" />
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
    </svg>
  ),
  PhoneOutgoing: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="23 7 23 1 17 1" />
      <line x1="16" y1="8" x2="23" y2="1" />
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
    </svg>
  ),
  PhoneMissed: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="23" y1="1" x2="17" y2="7" />
      <line x1="17" y1="1" x2="23" y2="7" />
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
    </svg>
  ),
  Moon: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  ),
  Sun: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  ),
  Check: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Info: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  Heart: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
    </svg>
  ),
  Star: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  Settings: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  ),
  Users: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  Bell: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  ),
  BellOff: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M13.73 21a2 2 0 01-3.46 0" />
      <path d="M18.63 13A17.89 17.89 0 0118 8" />
      <path d="M6.26 6.26A5.86 5.86 0 006 8c0 7-3 9-3 9h14" />
      <path d="M18 8a6 6 0 00-9.33-5" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ),
  Clock: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  Filter: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  ),
  UserPlus: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="20" y1="8" x2="20" y2="14" />
      <line x1="23" y1="11" x2="17" y2="11" />
    </svg>
  ),
  Trash: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  ),
  Copy: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  ),
  Reply: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 17 4 12 9 7" />
      <path d="M20 18v-2a4 4 0 00-4-4H4" />
    </svg>
  ),
  Forward: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="15 17 20 12 15 7" />
      <path d="M4 18v-2a4 4 0 014-4h12" />
    </svg>
  ),
  Flag: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  ),
  HelpCircle: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  Image: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  ),
  Palette: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="13.5" cy="6.5" r=".5" />
      <circle cx="17.5" cy="10.5" r=".5" />
      <circle cx="8.5" cy="7.5" r=".5" />
      <circle cx="6.5" cy="12.5" r=".5" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 011.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
    </svg>
  ),
  Link: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </svg>
  ),
  Edit: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  ThumbsUp: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
    </svg>
  ),
  Download: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  Share: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  ),
  UserX: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="18" y1="8" x2="23" y2="13" />
      <line x1="23" y1="8" x2="18" y2="13" />
    </svg>
  ),
  Pin: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="17" x2="12" y2="22" />
      <path d="M5 17h14v-1.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V6h1a2 2 0 000-4H8a2 2 0 000 4h1v4.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24z" />
    </svg>
  ),
  Volume: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
    </svg>
  ),
  Play: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
  Pause: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  ),
  Stop: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="6" y="6" width="12" height="12" rx="1" />
    </svg>
  ),
  PhoneOff: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7 2 2 0 011.72 2v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.42 19.42 0 01-3.33-2.67m-2.67-3.34a19.79 19.79 0 01-3.07-8.63A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91" />
      <line x1="23" y1="1" x2="1" y2="23" />
    </svg>
  ),
  VideoOff: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 16v1a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2h2m5.66 0H14a2 2 0 012 2v3.34l1 1L23 7v10" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ),
  Bot: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4" />
      <line x1="8" y1="16" x2="8" y2="16" />
      <line x1="16" y1="16" x2="16" y2="16" />
    </svg>
  ),
  Save: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  ),
  BarChart: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  ),
  Upload: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
  Globe: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
    </svg>
  ),
  SearchEmoji: (p: any) => (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
};

/* ============================================================================ */
/*  DADOS                                                                       */
/* ============================================================================ */
const INITIAL_CHATS: Chat[] = [];
const CALLS: Call[] = [];

const WALLPAPERS = [
  {
    id: "default",
    nameKey: "default",
    type: "pattern",
    value:
      "radial-gradient(circle at 20% 30%, rgba(37, 211, 102, 0.03) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(37, 211, 102, 0.03) 0%, transparent 50%)",
  },
  { id: "solid-white", nameKey: "white", type: "solid", value: "#FFFFFF" },
  { id: "solid-cream", nameKey: "cream", type: "solid", value: "#F7F5F3" },
  { id: "solid-gray", nameKey: "gray", type: "solid", value: "#E8E8E8" },
  { id: "solid-blue", nameKey: "blue", type: "solid", value: "#E3F2FD" },
  { id: "solid-green", nameKey: "green", type: "solid", value: "#E8F5E9" },
  { id: "solid-yellow", nameKey: "yellow", type: "solid", value: "#FFFDE7" },
  { id: "solid-pink", nameKey: "pink", type: "solid", value: "#FCE4EC" },
  { id: "solid-purple", nameKey: "purple", type: "solid", value: "#F3E5F5" },
  {
    id: "gradient-sunset",
    nameKey: "sunset",
    type: "gradient",
    value: "linear-gradient(135deg, #FF6B6B 0%, #FFE66D 100%)",
  },
  {
    id: "gradient-ocean",
    nameKey: "ocean",
    type: "gradient",
    value: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  },
  {
    id: "gradient-forest",
    nameKey: "forest",
    type: "gradient",
    value: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
  },
  {
    id: "gradient-rose",
    nameKey: "rose",
    type: "gradient",
    value: "linear-gradient(135deg, #ee9ca7 0%, #ffdde1 100%)",
  },
  {
    id: "gradient-night",
    nameKey: "night",
    type: "gradient",
    value: "linear-gradient(135deg, #232526 0%, #414345 100%)",
  },
  {
    id: "gradient-peach",
    nameKey: "peach",
    type: "gradient",
    value: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)",
  },
  {
    id: "gradient-mint",
    nameKey: "mint",
    type: "gradient",
    value: "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
  },
  {
    id: "pattern-dots",
    nameKey: "dots",
    type: "pattern",
    value: "radial-gradient(circle, rgba(0,0,0,0.05) 1px, transparent 1px)",
    size: "16px 16px",
  },
  {
    id: "pattern-lines",
    nameKey: "lines",
    type: "pattern",
    value:
      "repeating-linear-gradient(45deg, rgba(0,0,0,0.03) 0px, rgba(0,0,0,0.03) 1px, transparent 1px, transparent 10px)",
  },
  {
    id: "pattern-circles",
    nameKey: "circles",
    type: "pattern",
    value:
      "radial-gradient(circle at 50% 50%, rgba(100,100,255,0.05) 0%, transparent 50%)",
  },
];

// As cores são preferências visuais individuais; não alteram as mensagens nem as cores do destinatário.
const BUBBLE_COLOURS = [
  { id: "default", color: "#116b62", text: "#ffffff", label: "Institucional" },
  { id: "green", color: "#075e54", text: "#ffffff", label: "Verde escuro" },
  { id: "mint", color: "#d9fdd3", text: "#183629", label: "Verde claro" },
  { id: "blue", color: "#2257ae", text: "#ffffff", label: "Azul" },
  { id: "purple", color: "#6941a5", text: "#ffffff", label: "Roxo" },
  { id: "rose", color: "#9d336c", text: "#ffffff", label: "Rosa" },
  { id: "orange", color: "#a64d24", text: "#ffffff", label: "Laranja" },
  { id: "slate", color: "#374151", text: "#ffffff", label: "Cinza" },
  { id: "cream", color: "#fff3c4", text: "#433a22", label: "Creme" },
] as const;

const EMOJI_CATEGORIES = [
  {
    id: "frequent",
    nameKey: "frequent",
    icon: "Clock",
    emojis: [
      "😀",
      "😂",
      "",
      "❤️",
      "👍",
      "",
      "🔥",
      "",
      "",
      "🙏",
      "😘",
      "",
      "",
      "😊",
      "",
      "😅",
      "😢",
      "",
      "",
      "",
    ],
  },
  {
    id: "smileys",
    nameKey: "smileys",
    icon: "Smile",
    emojis: [
      "😀",
      "😃",
      "",
      "😁",
      "😆",
      "😅",
      "",
      "😂",
      "🙂",
      "🙃",
      "😉",
      "😊",
      "",
      "🥰",
      "",
      "",
      "😘",
      "",
      "😚",
      "",
      "",
      "😋",
      "",
      "😜",
      "",
      "😝",
      "🤑",
      "",
      "🤭",
      "🤫",
      "",
      "🤐",
      "🤨",
      "",
      "",
      "😶",
      "🫥",
      "",
      "",
      "",
      "",
      "🤥",
      "😌",
      "😔",
      "",
      "🤤",
      "",
      "",
      "🤒",
      "",
      "🤢",
      "",
      "",
      "",
      "",
      "😵",
      "",
      "🤠",
      "🥸",
      "",
      "🤓",
      "🧐",
      "😕",
      "",
      "",
      "",
      "️",
      "",
      "😯",
      "😲",
      "",
      "",
      "🥹",
      "",
      "",
      "😨",
      "",
      "😥",
      "",
      "😭",
      "",
      "😖",
      "",
      "😞",
      "",
      "😩",
      "😫",
      "",
      "😤",
      "",
      "😠",
      "",
      "😈",
      "",
      "",
      "️",
      "",
      "🤡",
      "",
      "",
      "👻",
      "👽",
      "",
      "🤖",
    ],
  },
  {
    id: "gestures",
    nameKey: "gestures",
    icon: "Smile",
    emojis: [
      "",
      "",
      "🖐️",
      "✋",
      "",
      "",
      "🫲",
      "",
      "🫴",
      "🫷",
      "",
      "👌",
      "",
      "",
      "✌️",
      "🤞",
      "",
      "🤟",
      "🤘",
      "",
      "👈",
      "👉",
      "",
      "",
      "👇",
      "☝️",
      "",
      "",
      "👎",
      "✊",
      "",
      "",
      "",
      "👏",
      "",
      "",
      "👐",
      "",
      "",
      "🙏",
      "✍️",
      "",
      "🤳",
      "💪",
      "",
      "",
      "🦶",
      "",
      "🦻",
      "👃",
      "",
      "",
      "🫁",
      "",
      "",
      "👀",
      "️",
      "",
      "",
      "",
    ],
  },
  {
    id: "hearts",
    nameKey: "hearts",
    icon: "Heart",
    emojis: [
      "❤️",
      "",
      "💛",
      "💚",
      "💙",
      "",
      "",
      "🤍",
      "🤎",
      "❤️",
      "❤️",
      "️",
      "",
      "💞",
      "",
      "💗",
      "💖",
      "💘",
      "",
      "💟",
      "️",
      "✝️",
      "️",
      "️",
      "☸️",
      "✡️",
      "",
      "",
      "☯️",
      "️",
      "",
      "",
      "♈",
      "♉",
      "",
      "♋",
      "",
      "♍",
      "",
      "♏",
      "",
      "♑",
      "♒",
      "",
      "🆔",
      "⚛️",
      "",
      "☢️",
      "☣️",
      "",
      "📳",
      "",
      "",
      "🈸",
      "",
      "️",
      "️",
      "",
      "💮",
      "",
      "️",
      "️",
      "",
      "🈵",
      "🈹",
      "",
      "️",
      "️",
    ],
  },
  {
    id: "animals",
    nameKey: "animals",
    icon: "Smile",
    emojis: [
      "",
      "",
      "🐭",
      "",
      "",
      "",
      "",
      "🐼",
      "🐨",
      "",
      "",
      "",
      "🐷",
      "🐸",
      "",
      "",
      "",
      "",
      "",
      "🐔",
      "",
      "🐦",
      "🐤",
      "",
      "🐥",
      "🦆",
      "",
      "🦉",
      "",
      "",
      "",
      "🐴",
      "",
      "",
      "",
      "",
      "",
      "🐞",
      "",
      "",
      "",
      "",
      "️",
      "️",
      "🦂",
      "",
      "🐍",
      "🦎",
      "",
      "🦕",
      "",
      "",
      "🦐",
      "",
      "",
      "",
      "",
      "",
      "",
      "🐳",
      "",
      "🦈",
      "",
      "",
      "🐆",
      "",
      "",
      "🦧",
      "🐘",
      "",
      "",
      "",
      "",
      "🦒",
      "",
      "",
      "🐂",
      "🐄",
      "",
      "",
      "🐏",
      "",
      "",
      "",
      "",
      "",
      "🐩",
      "",
      "🐕‍",
      "",
      "",
      "🪶",
      "",
      "",
      "🦤",
      "🦚",
      "",
      "🦢",
      "🦩",
      "️",
      "",
      "🦝",
      "",
      "",
      "",
      "",
      "",
      "🐁",
      "",
      "🐿️",
      "",
    ],
  },
  {
    id: "food",
    nameKey: "food",
    icon: "Smile",
    emojis: [
      "",
      "",
      "🍐",
      "",
      "🍋",
      "",
      "",
      "🍇",
      "🍓",
      "",
      "",
      "🍒",
      "",
      "",
      "",
      "",
      "",
      "🍅",
      "",
      "",
      "",
      "",
      "",
      "🌶️",
      "",
      "🌽",
      "",
      "",
      "🧄",
      "🧅",
      "",
      "",
      "🥐",
      "🥯",
      "",
      "",
      "🥨",
      "🧀",
      "",
      "",
      "🧈",
      "",
      "",
      "",
      "",
      "🍗",
      "🍖",
      "",
      "",
      "🍔",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "🫕",
      "",
      "",
      "",
      "",
      "🍛",
      "🍣",
      "",
      "",
      "",
      "",
      "🍙",
      "",
      "",
      "🍥",
      "",
      "",
      "",
      "🍡",
      "",
      "🍨",
      "",
      "",
      "🧁",
      "🍰",
      "",
      "",
      "🍭",
      "",
      "🍫",
      "",
      "",
      "🍪",
      "🌰",
      "",
      "",
    ],
  },
  {
    id: "activities",
    nameKey: "activities",
    icon: "Smile",
    emojis: [
      "",
      "",
      "🏈",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "🏒",
      "",
      "",
      "🏏",
      "🪃",
      "",
      "",
      "🪁",
      "🏹",
      "",
      "",
      "🥊",
      "",
      "",
      "",
      "",
      "",
      "⛸️",
      "🥌",
      "🎿",
      "️",
      "",
      "",
      "🏋️",
      "",
      "️",
      "🤺",
      "🤾",
      "️",
      "",
      "🧘",
      "",
      "",
      "",
      "🚣",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "️",
      "️",
      "️",
      "",
      "️",
      "",
      "🎭",
      "🎨",
      "",
      "🎤",
      "🎧",
      "",
      "🎹",
      "🥁",
      "",
      "🎷",
      "",
      "",
      "🎸",
      "🪕",
      "",
      "",
      "🎳",
      "",
      "",
      "🎲",
      "🧩",
      "",
      "",
      "🪄",
    ],
  },
  {
    id: "objects",
    nameKey: "objects",
    icon: "Smile",
    emojis: [
      "",
      "",
      "",
      "💻",
      "⌨️",
      "️",
      "🖨️",
      "️",
      "️",
      "️",
      "🗜️",
      "",
      "",
      "💿",
      "📀",
      "",
      "📷",
      "📸",
      "",
      "",
      "📽️",
      "️",
      "📞",
      "️",
      "📟",
      "",
      "",
      "",
      "️",
      "️",
      "️",
      "",
      "️",
      "️",
      "",
      "🕰️",
      "",
      "⏳",
      "📡",
      "",
      "",
      "",
      "",
      "🔦",
      "️",
      "",
      "",
      "️",
      "",
      "💵",
      "",
      "💶",
      "",
      "🪙",
      "",
      "💳",
      "💎",
      "️",
      "🪜",
      "🧰",
      "",
      "",
      "",
      "️",
      "️",
      "️",
      "",
      "",
      "️",
      "",
      "🧱",
      "⛓️",
      "",
      "🔫",
      "",
      "",
      "",
      "",
      "🗡️",
      "⚔️",
      "️",
      "",
      "️",
      "",
      "️",
      "🏺",
      "",
      "",
      "🧿",
      "",
      "️",
      "",
      "",
      "️",
      "",
      "🩺",
      "",
      "",
      "🩸",
      "🩼",
      "",
      "",
      "",
      "",
      "",
      "🌡️",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "🛀",
      "",
      "",
      "",
      "🧽",
      "🪣",
      "",
      "️",
      "",
      "🗝️",
      "🚪",
      "",
      "️",
      "️",
      "",
      "",
      "🪆",
      "🖼️",
      "",
      "",
      "️",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "🎎",
      "",
      "🎐",
      "🧧",
      "✉️",
      "",
      "📨",
      "",
      "",
      "",
      "📤",
      "📦",
      "️",
      "",
      "📪",
      "",
      "",
      "📭",
      "",
      "📯",
      "",
      "",
      "📄",
      "",
      "",
      "",
      "",
      "📉",
      "️",
      "️",
      "📆",
      "",
      "️",
      "",
      "️",
      "️",
      "️",
      "",
      "",
      "📂",
      "️",
      "️",
      "📰",
      "",
      "",
      "📒",
      "",
      "📗",
      "",
      "",
      "",
      "📖",
      "",
      "🧷",
      "",
      "",
      "️",
      "📐",
      "",
      "",
      "",
      "",
      "✂️",
      "🖊️",
      "🖋️",
      "️",
      "️",
      "🖍️",
      "",
      "✏️",
      "",
      "",
      "",
      "🔐",
      "",
      "🔓",
    ],
  },
  {
    id: "flags",
    nameKey: "flags",
    icon: "Smile",
    emojis: [
      "",
      "🚩",
      "",
      "",
      "🏳️",
      "️",
      "🏳️⚧️",
      "☠️",
      "",
      "🇧🇷",
      "🇵",
      "🇺",
      "🇬",
      "🇫",
      "🇪",
      "🇹",
      "🇪",
      "🇨",
      "🇵",
      "",
      "🇳",
      "🇷🇺",
      "🇲🇽",
      "",
      "",
      "🇦",
      "",
      "🇳🇬",
      "🇪",
      "",
      "🇹",
      "",
      "",
      "🇮🇱",
      "🇦",
      "🇦",
      "🇰",
      "🇭",
      "",
      "",
      "🇧",
      "",
      "🇪",
      "🇸",
      "🇸",
      "🇦🇫",
      "🇰",
      "🇧",
      "🇰",
      "🇵",
      "",
      "🇭",
      "",
      "🇭",
      "🇱",
      "",
      "",
      "🇮",
      "🇵🇭",
      "🇹🇼",
      "🇭",
      "",
      "🇳",
      "🇰",
      "🇺",
      "🇲",
      "",
      "🇩",
      "",
      "🇸",
      "",
      "",
      "🇾",
      "🇷",
      "🇪",
      "🇨🇴",
      "",
      "🇪",
      "🇴",
      "",
      "🇺",
      "🇨",
      "🇷",
      "",
      "🇸",
      "🇧",
      "🇹",
      "🇳",
      "🇮",
      "🇨🇷",
      "",
      "",
      "🇲",
    ],
  },
  {
    id: "symbols",
    nameKey: "symbols",
    icon: "Smile",
    emojis: [
      "",
      "",
      "🟡",
      "",
      "",
      "🟣",
      "",
      "⚪",
      "",
      "",
      "🔷",
      "",
      "",
      "",
      "🔻",
      "",
      "",
      "",
      "🔲",
      "▪️",
      "▫️",
      "◾",
      "",
      "◼️",
      "️",
      "",
      "",
      "",
      "",
      "",
      "🟪",
      "",
      "⬜",
      "",
      "",
      "🔇",
      "",
      "🔊",
      "",
      "",
      "",
      "",
      "",
      "️",
      "♠️",
      "♣️",
      "♥️",
      "♦️",
      "",
      "",
      "",
      "",
      "",
      "🕒",
      "🕓",
      "",
      "🕕",
      "🕖",
      "",
      "",
      "🕙",
      "",
      "🕛",
      "🕜",
      "",
      "🕞",
      "🕟",
      "",
      "🕡",
      "🕢",
      "",
      "🕤",
      "🕥",
      "",
      "🕧",
      "⭕",
      "✅",
      "️",
      "✔️",
      "❌",
      "",
      "",
      "➖",
      "➗",
      "️",
      "",
      "💱",
      "©️",
      "®️",
      "™️",
      "#️⃣",
      "*️",
      "0️",
      "1️",
      "2️⃣",
      "3️",
      "4️⃣",
      "5️",
      "6️⃣",
      "7️",
      "8️⃣",
      "9️",
      "",
    ],
  },
];

/* ============================================================================ */
/*  IA - Respostas Automáticas (multi-idioma)                                   */
/* ============================================================================ */
const CHAT_CSS = `.laicisa-chat{
    --dashboard-blue: #1F4E79;
    --dashboard-blue-dark: #163A5C;
    --dashboard-blue-darker: #0F2A47;
    --dashboard-green: #548235;
    --dashboard-orange: #ED7D31;
    --dashboard-gray: #7F7F7F;
    --dashboard-blue-chart: #4472C4;
    --dashboard-yellow: #FFC000;
    --dashboard-gray-light: #A5A5A5;
    --dashboard-red: #E84C3D;
    --WDS-green-400: #25d366;
    --WDS-green-450: #21c063;
    --WDS-green-500: #1daa61;
    --WDS-green-700: #15603e;
    --WDS-accent: #1DAA61;
    --WDS-accent-deemphasized: #D9FDD3;
    --WDS-surface-emphasized: #F7F5F3;
    --WDS-surface-default: #FFFFFF;
    --WDS-background-wash-inset: #F7F5F3;
    --WDS-background-wash-plain: #FFFFFF;
    --WDS-content-default: #0A0A0A;
    --WDS-content-deemphasized: rgba(0, 0, 0, .6);
    --WDS-content-disabled: #BDBDBD;
    --WDS-lines-divider: rgba(0, 0, 0, .1);
    --WDS-lines-outline-default: #959393;
    --WDS-persistent-always-white: #FFFFFF;
    --WDS-neutral-gray-50: #fafafa;
    --WDS-neutral-gray-100: #eeeeee;
    --WDS-neutral-gray-400: #959393;
    --WDS-neutral-gray-500: #757778;
    --WDS-neutral-gray-700: #424445;
    --WDS-neutral-gray-800: #242626;
    --WDS-neutral-gray-1000: #0a0a0a;
    --WDS-cool-gray-200: #d4d6d8;
    --WDS-warm-gray-75: #f7f5f3;
    --WDS-warm-gray-100: #f1eeeb;
    --WDS-warm-gray-200: #dbd8d4;
    --WDS-warm-gray-300: #c2bdb8;
    --WDS-warm-gray-300-alpha-15: rgba(194, 189, 184, .15);
    --navbar-width: 72px;
    --font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
.laicisa-chat.chat-dark{
    --WDS-surface-emphasized: #202c33;
    --WDS-surface-default: #111b21;
    --WDS-background-wash-inset: #0b141a;
    --WDS-background-wash-plain: #0b141a;
    --WDS-content-default: #e9edef;
    --WDS-content-deemphasized: rgba(233, 237, 239, .6);
    --WDS-lines-divider: rgba(134, 150, 160, .15);
    --WDS-warm-gray-75: #202c33;
    --WDS-warm-gray-100: #202c33;
    --WDS-warm-gray-200: #2a3942;
    --WDS-warm-gray-300: #3b4a54;
    --WDS-warm-gray-300-alpha-15: rgba(134, 150, 160, .15);
    --WDS-neutral-gray-1000: #e9edef;
    --WDS-neutral-gray-500: #aebac1;
    --WDS-neutral-gray-400: #8696a0;
    --WDS-neutral-gray-100: #2a3942;
    --WDS-neutral-gray-800: #111b21;
}
.laicisa-chat *{ margin: 0; padding: 0; box-sizing: border-box; }
.laicisa-chat, .laicisa-chat{ height: 100%; overflow: hidden; font-family: var(--font-family); background: var(--WDS-background-wash-inset); color: var(--WDS-content-default); }
.laicisa-chat .app-wrapper{ display: flex; height: 100%; width: 100%; background: var(--WDS-background-wash-plain); }
.laicisa-chat .navbar{ width: var(--navbar-width); background: var(--dashboard-blue); display: flex; flex-direction: column; align-items: center; padding: 12px 0; border-right: 4px solid var(--dashboard-blue-dark); flex-shrink: 0; }
.laicisa-chat .nav-logo{ width: 36px; height: 36px; margin-bottom: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.laicisa-chat .nav-logo svg{ width: 32px; height: 32px; fill: white; }
.laicisa-chat .nav-items{ display: flex; flex-direction: column; gap: 4px; flex: 1; width: 100%; padding: 0 10px; }
.laicisa-chat .nav-item{ width: 52px; height: 52px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.4); background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; position: relative; color: rgba(255,255,255,0.7); transition: background .15s; }
.laicisa-chat .nav-item:hover{ background: rgba(255,255,255,0.2); color: white; }
.laicisa-chat .nav-item.active{ background: white; color: var(--dashboard-blue); border-color: white; }
.laicisa-chat .nav-item svg{ width: 24px; height: 24px; fill: currentColor; }
.laicisa-chat .nav-badge{ position: absolute; top: 6px; right: 6px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: var(--dashboard-red); color: white; font-size: 11px; font-weight: 600; display: flex; align-items: center; justify-content: center; border: 2px solid white; }
.laicisa-chat .nav-badge.hidden{ display: none; }
.laicisa-chat .nav-footer{ display: flex; flex-direction: column; gap: 8px; padding: 0 10px; width: 100%; }
.laicisa-chat .nav-avatar{ width: 40px; height: 40px; border-radius: 50%; background: white; color: var(--dashboard-blue); margin: 0 auto; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px; border: 2px solid white; }
.laicisa-chat .main-panel{ flex: 1; display: flex; flex-direction: column; min-width: 0; max-width: 520px; background: var(--WDS-surface-default); }
.laicisa-chat .panel-header{ height: 60px; padding: 0 16px; display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid var(--dashboard-blue-dark); background: var(--dashboard-blue); color: white; flex-shrink: 0; }
.laicisa-chat .panel-title{ font-size: 18px; font-weight: 700; color: white; text-transform: uppercase; letter-spacing: 0.05em; }
.laicisa-chat .header-actions{ display: flex; gap: 4px; }
.laicisa-chat .icon-btn{ width: 36px; height: 36px; border-radius: 50%; border: none; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.8); transition: background .15s; }
.laicisa-chat .icon-btn:hover{ background: rgba(255,255,255,0.15); color: white; }
.laicisa-chat .icon-btn svg{ width: 20px; height: 20px; fill: currentColor; }
.laicisa-chat .search-box{ padding: 8px 12px; border-bottom: 2px solid #E0E0E0; background: #F5F5F5; }
.laicisa-chat .search-input-wrap{ display: flex; align-items: center; gap: 12px; background: white; border: 2px solid #D0D0D0; border-radius: 8px; padding: 6px 12px; height: 36px; }
.laicisa-chat .search-input-wrap svg{ width: 18px; height: 18px; fill: var(--dashboard-gray); flex-shrink: 0; }
.laicisa-chat .search-input{ flex: 1; border: none; background: transparent; outline: none; font-size: 14px; color: var(--WDS-content-default); font-family: inherit; }
.laicisa-chat .search-input::placeholder{ color: var(--WDS-content-deemphasized); }
.laicisa-chat .search-clear{ border: none; background: transparent; cursor: pointer; display: none; align-items: center; justify-content: center; color: var(--dashboard-gray); }
.laicisa-chat .search-clear.show{ display: flex; }
.laicisa-chat .search-clear svg{ width: 16px; height: 16px; fill: currentColor; }
.laicisa-chat .filters{ display: flex; gap: 8px; padding: 8px 12px; border-bottom: 2px solid #E0E0E0; overflow-x: auto; flex-shrink: 0; background: white; }
.laicisa-chat .filters::-webkit-scrollbar{ display: none; }
.laicisa-chat .filter-btn{ padding: 6px 14px; border-radius: 18px; border: 2px solid #D0D0D0; background: white; color: var(--WDS-content-default); font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; transition: all .15s; font-family: inherit; }
.laicisa-chat .filter-btn:hover{ background: #F0F0F0; border-color: var(--dashboard-blue); }
.laicisa-chat .filter-btn.active{ background: var(--dashboard-blue); color: white; border-color: var(--dashboard-blue); }
.laicisa-chat .chat-list{ flex: 1; overflow-y: auto; overflow-x: hidden; }
.laicisa-chat .chat-list::-webkit-scrollbar{ width: 6px; }
.laicisa-chat .chat-list::-webkit-scrollbar-track{ background: transparent; }
.laicisa-chat .chat-list::-webkit-scrollbar-thumb{ background: var(--WDS-warm-gray-300); border-radius: 3px; }
.laicisa-chat .chat-item{ display: flex; align-items: center; gap: 12px; padding: 10px 14px; cursor: pointer; transition: background .1s; border-bottom: 1px solid #E8E8E8; position: relative; }
.laicisa-chat .chat-item:hover{ background: #F5F5F5; }
.laicisa-chat .chat-item.active{ background: #E8F0FE; border-left: 3px solid var(--dashboard-blue); }
.laicisa-chat .chat-avatar{ width: 49px; height: 49px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 18px; overflow: hidden; }
.laicisa-chat .chat-avatar img{ width: 100%; height: 100%; object-fit: cover; }
.laicisa-chat .chat-info{ flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.laicisa-chat .chat-top{ display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.laicisa-chat .chat-name{ font-size: 16px; font-weight: 600; color: var(--WDS-content-default); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
.laicisa-chat .chat-time{ font-size: 12px; color: var(--WDS-content-deemphasized); white-space: nowrap; flex-shrink: 0; }
.laicisa-chat .chat-item.unread .chat-time{ color: var(--dashboard-blue); font-weight: 700; }
.laicisa-chat .chat-bottom{ display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.laicisa-chat .chat-preview{ font-size: 14px; color: var(--WDS-content-deemphasized); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; display: flex; align-items: center; gap: 4px; }
.laicisa-chat .chat-preview svg{ width: 18px; height: 18px; fill: var(--WDS-content-deemphasized); flex-shrink: 0; }
.laicisa-chat .chat-item.unread .chat-preview{ color: var(--WDS-content-default); font-weight: 600; }
.laicisa-chat .chat-item.unread .chat-preview svg{ fill: var(--dashboard-blue); }
.laicisa-chat .unread-badge{ min-width: 20px; height: 20px; padding: 0 6px; border-radius: 10px; background: var(--dashboard-red); color: white; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 2px solid white; }
.laicisa-chat .section-header{ padding: 12px 16px 6px; font-size: 12px; font-weight: 700; color: var(--dashboard-blue); background: white; text-transform: uppercase; letter-spacing: 0.05em; }
.laicisa-chat .no-results{ padding: 40px 20px; text-align: center; color: var(--WDS-content-deemphasized); font-size: 14px; }
.laicisa-chat .archived-btn{ display: flex; align-items: center; gap: 24px; padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #E8E8E8; transition: background .1s; }
.laicisa-chat .archived-btn:hover{ background: #F5F5F5; }
.laicisa-chat .archived-btn svg{ width: 24px; height: 24px; fill: var(--dashboard-gray); }
.laicisa-chat .archived-btn span{ font-size: 15px; color: var(--WDS-content-default); flex: 1; }
.laicisa-chat .archived-count{ font-size: 14px; color: var(--WDS-content-deemphasized); }
.laicisa-chat .e2e-message{ padding: 12px 16px; display: flex; align-items: center; gap: 8px; background: #F0F7FF; border-bottom: 1px solid #E0E0E0; font-size: 12px; color: var(--dashboard-blue); }
.laicisa-chat .e2e-message svg{ width: 14px; height: 14px; fill: currentColor; flex-shrink: 0; }
.laicisa-chat .e2e-message a{ color: var(--dashboard-blue); text-decoration: none; }
.laicisa-chat .chat-view{ flex: 1; display: flex; flex-direction: column; background: var(--WDS-background-wash-inset); min-width: 0; position: relative; }
.laicisa-chat .chat-view-header{ height: 60px; padding: 0 16px; display: flex; align-items: center; gap: 12px; background: var(--dashboard-blue); border-bottom: 2px solid var(--dashboard-blue-dark); flex-shrink: 0; }
.laicisa-chat .chat-view-avatar{ width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; flex-shrink: 0; }
.laicisa-chat .chat-view-info{ flex: 1; min-width: 0; cursor: pointer; }
.laicisa-chat .chat-view-name{ font-size: 16px; font-weight: 600; color: white; }
.laicisa-chat .chat-view-status{ font-size: 13px; color: rgba(255,255,255,0.8); }
.laicisa-chat .chat-view-actions{ display: flex; gap: 4px; }
.laicisa-chat .back-btn{ display: none; }
.laicisa-chat .messages-area{ flex: 1; overflow-y: auto; padding: 20px 60px; display: flex; flex-direction: column; gap: 4px; }
.laicisa-chat .messages-area::-webkit-scrollbar{ width: 6px; }
.laicisa-chat .messages-area::-webkit-scrollbar-thumb{ background: var(--WDS-warm-gray-300); border-radius: 3px; }
.laicisa-chat .date-separator{ align-self: center; padding: 6px 12px; background: var(--dashboard-blue); color: white; border-radius: 8px; font-size: 12px; font-weight: 600; margin: 12px 0; box-shadow: 0 1px 1px rgba(0,0,0,0.05); }
.laicisa-chat .message{ max-width: 65%; padding: 6px 10px 8px; border-radius: 8px; position: relative; font-size: 14.2px; line-height: 19px; word-wrap: break-word; box-shadow: 0 1px 0.5px rgba(0,0,0,0.08); }
.laicisa-chat .message.received{ background: var(--WDS-surface-default); align-self: flex-start; border-top-left-radius: 0; border: 1px solid #E0E0E0; }
.laicisa-chat .message.sent{ background: var(--dashboard-blue); color: white; align-self: flex-end; border-top-right-radius: 0; }
.laicisa-chat .message.ai{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; align-self: flex-start; border-top-left-radius: 0; }
.laicisa-chat .dark .message.sent{ background: #005c4b; }
.laicisa-chat .message-text{ color: inherit; padding-right: 55px; white-space: pre-wrap; }
.laicisa-chat .message-meta{ position: absolute; bottom: 4px; right: 8px; display: flex; align-items: center; gap: 3px; font-size: 11px; color: var(--WDS-content-deemphasized); }
.laicisa-chat .message.sent .message-meta, .laicisa-chat .message.ai .message-meta{ color: rgba(255,255,255,0.8); }
.laicisa-chat .message-meta svg{ width: 16px; height: 11px; fill: var(--dashboard-green); }
.laicisa-chat .message.sent .message-meta svg, .laicisa-chat .message.ai .message-meta svg{ fill: white; }
.laicisa-chat .composer{ min-height: 62px; padding: 8px 16px; display: flex; align-items: center; gap: 8px; background: var(--dashboard-blue); border-top: 2px solid var(--dashboard-blue-dark); flex-shrink: 0; position: relative; }
.laicisa-chat .composer-input-wrap{ flex: 1; background: var(--WDS-surface-default); border-radius: 8px; padding: 9px 12px; min-height: 42px; display: flex; align-items: center; }
.laicisa-chat .composer-input{ flex: 1; border: none; background: transparent; outline: none; font-size: 15px; color: var(--WDS-content-default); font-family: inherit; resize: none; max-height: 100px; }
.laicisa-chat .composer-input::placeholder{ color: var(--WDS-content-deemphasized); }
.laicisa-chat .send-btn svg{ fill: white; }
.laicisa-chat .emoji-picker{ position: absolute; bottom: 64px; left: 8px; background: var(--WDS-surface-default); border: 1px solid var(--WDS-lines-divider); border-radius: 10px; padding: 10px; display: none; grid-template-columns: repeat(8, 1fr); gap: 4px; box-shadow: 0 4px 16px rgba(0,0,0,0.15); z-index: 10; }
.laicisa-chat .emoji-picker.show{ display: grid; }
.laicisa-chat .emoji-picker button{ border: none; background: transparent; font-size: 20px; cursor: pointer; border-radius: 6px; padding: 4px; line-height: 1; }
.laicisa-chat .emoji-picker button:hover{ background: var(--WDS-warm-gray-300-alpha-15); }
.laicisa-chat .empty-state{ flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; text-align: center; background: var(--WDS-warm-gray-75); border-bottom: 6px solid var(--dashboard-blue); }
.laicisa-chat .empty-state-icon{ width: 320px; height: 188px; margin-bottom: 40px; display: flex; align-items: center; justify-content: center; }
.laicisa-chat .empty-state-icon svg{ width: 260px; height: 160px; fill: var(--dashboard-gray); opacity: 0.4; }
.laicisa-chat .empty-state h2{ font-size: 32px; font-weight: 300; color: var(--dashboard-blue); margin-bottom: 16px; }
.laicisa-chat .empty-state p{ font-size: 14px; color: var(--WDS-content-deemphasized); max-width: 500px; line-height: 20px; }
.laicisa-chat .av-1{ background: linear-gradient(135deg, #1F4E79, #2A6BA8); }
.laicisa-chat .av-2{ background: linear-gradient(135deg, #548235, #6BA845); }
.laicisa-chat .av-3{ background: linear-gradient(135deg, #ED7D31, #F49A4A); }
.laicisa-chat .av-4{ background: linear-gradient(135deg, #7F7F7F, #999999); }
.laicisa-chat .av-5{ background: linear-gradient(135deg, #4472C4, #5A8AE0); }
.laicisa-chat .av-6{ background: linear-gradient(135deg, #FFC000, #FFD54F); }
.laicisa-chat .av-7{ background: linear-gradient(135deg, #E84C3D, #F06B5E); }
.laicisa-chat .av-8{ background: linear-gradient(135deg, #A5A5A5, #BFBFBF); }
.laicisa-chat .av-9{ background: linear-gradient(135deg, #5B9BD5, #7DB4E8); }
.laicisa-chat .av-10{ background: linear-gradient(135deg, #70AD47, #8BC34A); }
.laicisa-chat .toast{ position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateY(20px); background: var(--dashboard-blue); color: white; padding: 10px 18px; border-radius: 8px; font-size: 13px; font-weight: 600; opacity: 0; pointer-events: none; transition: opacity .2s, transform .2s; z-index: 100; border: 2px solid var(--dashboard-blue-dark); }
.laicisa-chat .toast.show{ opacity: 1; transform: translateX(-50%) translateY(0); }
@media (max-width: 900px) {.laicisa-chat .chat-view{ display: none; } .laicisa-chat .chat-view.active{ display: flex; } .laicisa-chat .main-panel{ max-width: none; } .laicisa-chat .main-panel.hide-on-mobile{ display: none; } .laicisa-chat .back-btn{ display: flex; }}
@media (max-width: 600px) {.laicisa-chat .navbar{ width: 60px; } .laicisa-chat .nav-item{ width: 44px; height: 44px; } .laicisa-chat .messages-area{ padding: 12px; }}
.laicisa-chat .tab-content{ display: none; flex: 1; flex-direction: column; min-height: 0; }
.laicisa-chat .tab-content.active{ display: flex; }
.laicisa-chat { height:100%; min-height:420px; width:100%; position:relative; isolation:isolate; overflow:hidden; }
.laicisa-chat .app-wrapper {min-height:0;}
.laicisa-chat .toast {position:absolute; max-width:85%; text-align:center;}
.laicisa-chat .message-text {white-space:pre-wrap; overflow-wrap:anywhere;}
.laicisa-chat .chat-item {width:100%;text-align:left;border:0;background:transparent;color:inherit;font:inherit;}
.laicisa-chat .chat-item.active {background:var(--WDS-surface-emphasized);}
.laicisa-chat button:focus-visible {outline:2px solid var(--dashboard-blue);outline-offset:-2px;}
/* Revisão visual: superfícies e cartões leves, sem perder controlos existentes. */
.laicisa-chat{--dashboard-blue:#116b62;--dashboard-blue-dark:#0c514b;--dashboard-blue-darker:#073b36;--dashboard-green:#15816e;--WDS-background-wash-inset:#eef4f2;--WDS-surface-emphasized:#e8f6f1;--font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
.laicisa-chat.chat-dark{--WDS-background-wash-inset:#101d25;--WDS-surface-emphasized:#1b3840}
.laicisa-chat .app-wrapper{border:1px solid var(--WDS-lines-divider);border-radius:16px;box-shadow:0 14px 32px rgba(22,45,49,.12);overflow:hidden}
.laicisa-chat .navbar{border-right:0;background:linear-gradient(180deg,#0e625b,#123e4d);padding-top:16px}
.laicisa-chat .nav-item{border:1px solid rgba(255,255,255,.18);border-radius:14px;width:47px;height:47px;transition:transform .16s,background .16s}
.laicisa-chat .nav-item:hover{transform:translateY(-2px)}
.laicisa-chat .panel-header,.laicisa-chat .chat-view-header{background:var(--WDS-surface-default);color:var(--WDS-content-default);border-bottom:1px solid var(--WDS-lines-divider)}
.laicisa-chat .panel-title,.laicisa-chat .chat-view-name{color:var(--WDS-content-default);letter-spacing:0;text-transform:none}
.laicisa-chat .chat-view-status{color:var(--WDS-content-deemphasized)}
.laicisa-chat .panel-header .icon-btn,.laicisa-chat .chat-view-header .icon-btn{color:var(--dashboard-blue)}
.laicisa-chat .chat-item{border-bottom:1px solid var(--WDS-lines-divider);padding:13px 16px}
.laicisa-chat .chat-item.active{border-left:3px solid var(--dashboard-blue);background:var(--WDS-surface-emphasized)}
.laicisa-chat .chat-name{font-size:14px}
.laicisa-chat .chat-preview{font-size:12px}
.laicisa-chat .messages-area{padding:24px clamp(14px,4vw,54px);gap:9px;background:var(--WDS-background-wash-inset)}
.laicisa-chat .message{border-radius:16px;padding:12px 14px;max-width:min(75%,550px);line-height:1.5;box-shadow:0 2px 10px rgba(13,49,50,.08)}
.laicisa-chat .message.received{border:1px solid var(--WDS-lines-divider);border-top-left-radius:5px}
.laicisa-chat .message.sent{background:var(--nv-chat-sent-background,#116b62);color:var(--nv-chat-sent-text,#fff);border-top-right-radius:5px}
.laicisa-chat .message.sent .message-meta{color:var(--nv-chat-sent-text,#fff);opacity:.78}
.laicisa-chat .message.sent .message-meta svg{fill:var(--nv-chat-sent-text,#fff)}
.laicisa-chat .composer{background:var(--WDS-surface-default);border-top:1px solid var(--WDS-lines-divider);padding:12px 16px}
.laicisa-chat .composer-input-wrap{border:1px solid var(--WDS-lines-divider);border-radius:14px;background:var(--WDS-surface-emphasized)}
.laicisa-chat .date-separator{background:var(--WDS-surface-default);border:1px solid var(--WDS-lines-divider);color:var(--WDS-content-deemphasized);border-radius:20px;box-shadow:none}
.laicisa-chat .empty-state{border-bottom:0}
`;

const initial = (name: string) =>
  name.startsWith("+")
    ? ""
    : name === "Meta AI"
      ? ""
      : name.charAt(0).toUpperCase();
const callLabel = (type: string, lang: Language) => {
  const labels = {
    pt: {
      "video-out": "Vídeo efetuada",
      "video-in": "Vídeo recebida",
      "voice-out": "Voz efetuada",
      missed: "Perdida",
    },
    en: {
      "video-out": "Outgoing video",
      "video-in": "Incoming video",
      "voice-out": "Outgoing voice",
      missed: "Missed",
    },
    fr: {
      "video-out": "Vidéo sortante",
      "video-in": "Vidéo entrante",
      "voice-out": "Appel sortant",
      missed: "Manqué",
    },
  };
  return (
    labels[lang][type as keyof typeof labels.pt] ||
    (lang === "fr" ? "Reçu" : lang === "en" ? "Received" : "Recebida")
  );
};

/* ============================================================================ */
/*  COMPONENTE PRINCIPAL                                                        */
/* ============================================================================ */
function ChatView({ session }: ChatAppProps = {}) {
  const appTitle = `${session?.empresaNome?.trim() || "NV-DIGITAL"} · Chat`;
  const savedData = {
    chats: [] as Chat[],
    messages: {} as Record<string, Message[]>,
    wallpapersByChat: {} as Record<string, string>,
    dark: false,
    language: "pt" as Language,
  };
  const [chats, setChats] = useState<Chat[]>(savedData.chats);
  const [messages, setMessages] = useState<Record<string, Message[]>>(
    savedData.messages,
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [section, setSection] = useState("chats");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [callsSearch, setCallsSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiCategory, setEmojiCategory] = useState("frequent");
  const [emojiSearch, setEmojiSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [messageSearch, setMessageSearch] = useState("");
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [toast, setToast] = useState("");
  const [dark, setDark] = useState(savedData.dark);
  const [defaultBubbleColor, setDefaultBubbleColor] = useState("default");
  const [language, setLanguage] = useState<Language>(savedData.language);
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    messageId: string;
  } | null>(null);
  const [contactPanelOpen, setContactPanelOpen] = useState(false);
  const [wallpaperPanelOpen, setWallpaperPanelOpen] = useState(false);
  const [wallpaperTab, setWallpaperTab] = useState<
    "colors" | "patterns" | "my"
  >("colors");
  const [wallpapersByChat, setWallpapersByChat] = useState<
    Record<string, string>
  >(savedData.wallpapersByChat);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(
    null,
  );
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [reactionPicker, setReactionPicker] = useState<{
    x: number;
    y: number;
    messageId: string;
  } | null>(null);
  const [showMuteOptions, setShowMuteOptions] = useState(false);
  const [mediaGallery, setMediaGallery] = useState(false);
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [searchIndex, setSearchIndex] = useState(0);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(
    [],
  );
  const [callActive, setCallActive] = useState(false);
  const [callType, setCallType] = useState<"video" | "voice">("voice");
  const [callDuration, setCallDuration] = useState(0);
  const [callMuted, setCallMuted] = useState(false);
  const [callVideoOff, setCallVideoOff] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callTimerRef = useRef<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const [uploadingFile, setUploadingFile] = useState<{
    name: string;
    type: string;
    url: string;
    size: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [statsOpen, setStatsOpen] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const optionsMenuRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const t = useCallback(
    (key: string): string => {
      return (TRANSLATIONS[language][key] as string) || key;
    },
    [language],
  );

  const getWallpaperName = useCallback(
    (key: string): string => {
      const names = TRANSLATIONS[language].wallpaperNames as Record<
        string,
        string
      >;
      return names[key] || key;
    },
    [language],
  );

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "granted") {
      setNotificationsEnabled(true);
    }
  }, []);

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeId),
    [chats, activeId],
  );
  const currentMessages = useMemo(
    () => (activeId === null ? [] : (messages[activeId || ""] ?? [])),
    [activeId, messages],
  );
  const totalUnread = useMemo(
    () => chats.reduce((sum, chat) => sum + chat.unread, 0),
    [chats],
  );
  const favorites = useMemo(
    () => chats.filter((chat) => chat.pinned).map((chat) => chat.id),
    [chats],
  );

  const visibleChats = useMemo(() => {
    let filtered = chats.filter(
      (chat) =>
        !chat.hidden &&
        (filter !== "unread" || chat.unread > 0) &&
        (filter !== "groups" || chat.type === "group") &&
        (filter !== "favorites" || favorites.includes(chat.id)) &&
        `${chat.name} ${chat.preview}`
          .toLocaleLowerCase()
          .includes(search.toLocaleLowerCase()),
    );
    return filtered.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  }, [chats, filter, search, favorites]);

  const filteredEmojis = useMemo(() => {
    if (emojiSearch.trim()) {
      return EMOJI_CATEGORIES.flatMap((cat) => cat.emojis);
    }
    const cat = EMOJI_CATEGORIES.find((c) => c.id === emojiCategory);
    return cat ? cat.emojis : [];
  }, [emojiCategory, emojiSearch]);

  const currentWallpaper = useMemo(() => {
    if (activeId === null) return WALLPAPERS[0];
    const wpId = wallpapersByChat[activeId] || "default";
    if (wpId?.startsWith("data:image/"))
      return {
        id: wpId,
        nameKey: "myPhotos",
        type: "image",
        value: `url("${wpId}")`,
        size: "cover",
      };
    return WALLPAPERS.find((w) => w.id === wpId) || WALLPAPERS[0];
  }, [activeId, wallpapersByChat]);
  const currentBubble = useMemo(() =>
    BUBBLE_COLOURS.find((colour) => colour.id === (activeChat?.bubbleColor === "default"
      ? defaultBubbleColor : (activeChat?.bubbleColor || defaultBubbleColor))) || BUBBLE_COLOURS[0],
  [activeChat?.bubbleColor, defaultBubbleColor]);

  const chatStats = useMemo(() => {
    if (activeId === null) return null;
    const msgs = messages[activeId || ""] || [];
    const sent = msgs.filter((m) => m.type === "sent").length;
    const received = msgs.filter((m) => m.type === "received").length;
    const ai = msgs.filter((m) => m.aiGenerated).length;
    const withAttachments = msgs.filter((m) => m.attachment).length;
    const withAudio = msgs.filter(
      (m) => m.audio || m.attachment?.type === "audio",
    ).length;

    const days = TRANSLATIONS[language].dayNames as string[];
    const byDay = days.map((day, i) => ({
      day,
      count: msgs.filter((m) => new Date(m.timestamp).getDay() === i).length,
    }));

    const emojiCount: Record<string, number> = {};
    msgs.forEach((m) => {
      const emojis =
        m.text.match(
          /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
        ) || [];
      emojis.forEach((e) => {
        emojiCount[e] = (emojiCount[e] || 0) + 1;
      });
    });
    const topEmojis = Object.entries(emojiCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([emoji, count]) => ({ emoji, count }));

    return {
      total: msgs.length,
      sent,
      received,
      ai,
      withAttachments,
      withAudio,
      byDay,
      topEmojis,
      distribution: [
        { name: t("sent"), value: sent, color: "#1F4E79" },
        { name: t("received"), value: received, color: "#548235" },
        { name: t("ai"), value: ai, color: "#764ba2" },
      ].filter((d) => d.value > 0),
    };
  }, [activeId, messages, language, t]);

  const notify = useCallback(
    (text: string) => {
      setToast(text);
      if (
        notificationsEnabled &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        new Notification(appTitle, { body: text, icon: "" });
      }
    },
    [notificationsEnabled, appTitle],
  );

  const [serverError, setServerError] = useState("");
  const [serverLoading, setServerLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [forwardTarget, setForwardTarget] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [historyPages, setHistoryPages] = useState(1);
  const activeRef = useRef(activeId);
  activeRef.current = activeId;
  const live = useRef(true),
    requestSeq = useRef(0),
    inFlight = useRef(false);
  const busySend = useRef(false),
    busyGroup = useRef(false);
  const pendingSend = useRef<{ signature: string; id: string } | null>(null);
  const pendingGroup = useRef<{ signature: string; id: string } | null>(null);
  const blobs = useRef(new Map<string, string>());
  const settingsLoaded = useRef(false);
  const server = useCallback(
    <T,>(method: string, path: string, body?: unknown) =>
      hospitalApi<T>(method, "/chat-live" + path, body),
    [],
  );
  const report = useCallback((e: unknown) => {
    if (live.current)
      setServerError(
        e instanceof Error ? e.message : "Falha na ligação ao servidor.",
      );
  }, []);
  const loadAttachment = useCallback(async (a: any) => {
    let url = blobs.current.get(a.id);
    if (!url) {
      const response = await fetch(
        (import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "") +
          "/api/hospital/chat-live/attachments/" +
          encodeURIComponent(a.id),
        { headers: { Authorization: "Bearer " + api.getToken() } },
      );
      if (!response.ok) throw new Error("Não foi possível obter o anexo.");
      url = URL.createObjectURL(await response.blob());
      if (!live.current) {
        URL.revokeObjectURL(url);
        throw new Error("Sessão encerrada.");
      }
      blobs.current.set(a.id, url);
    }
    return {
      name: a.name,
      size: a.size,
      type: a.mime.startsWith("image/")
        ? "image"
        : a.mime.startsWith("audio/") || a.mime === "video/webm"
          ? "audio"
          : "file",
      url,
    };
  }, []);
  const refresh = useCallback(async () => {
    const seq = ++requestSeq.current,
      selected = activeId;
    inFlight.current = true;
    try {
      const state = await server<{
        chats: Chat[];
        settings: { dark?: boolean; language?: Language; bubbleColor?: string };
      }>("GET", "/state");
      if (!live.current || seq !== requestSeq.current) return;
      setChats(
        state.chats.map((c) => ({
          ...c,
          time: c.time
            ? new Date(c.time).toLocaleTimeString("pt-PT", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "",
        })),
      );
      setWallpapersByChat(
        Object.fromEntries(
          state.chats
            .filter((c) => c.wallpaper)
            .map((c) => [c.id, c.wallpaper!]),
        ),
      );
      if (!settingsLoaded.current) {
        setDark(!!state.settings.dark);
        setLanguage(state.settings.language || "pt");
        settingsLoaded.current = true;
      }
      setDefaultBubbleColor(
        BUBBLE_COLOURS.some((colour) => colour.id === state.settings.bubbleColor)
          ? state.settings.bubbleColor! : "default",
      );
      if (selected !== null) {
        const batch: any[] = [];
        let more = false;
        for (let page = 0; page < historyPages; page++) {
          const result = await server<{ messages: any[]; hasMore: boolean }>(
            "GET",
            "/messages?conversation=" +
              encodeURIComponent(selected) +
              "&offset=" +
              page * 100,
          );
          batch.unshift(...result.messages);
          more = result.hasMore;
          if (!more) break;
        }
        const converted: Message[] = await Promise.all(
          batch.map(async (m) => ({
            ...m,
            time: new Date(m.timestamp).toLocaleTimeString("pt-PT", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            attachment: m.attachments?.[0]
              ? await loadAttachment(m.attachments[0])
              : undefined,
          })),
        );
        // Mensagens antigas e recentes mantêm sempre a ordem efectiva de envio.
        converted.sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id));
        if (
          !live.current ||
          seq !== requestSeq.current ||
          activeRef.current !== selected
        )
          return;
        setMessages((prev) =>
          JSON.stringify(prev[selected]) === JSON.stringify(converted)
            ? prev
            : { ...prev, [selected]: converted },
        );
        setHasMore(more);
        const last = batch.at(-1);
        if (last && !document.hidden)
          await server("POST", "/read", {
            conversation: selected,
            lastId: last.id,
          });
      }
      if (live.current && seq === requestSeq.current) setServerError("");
    } catch (e) {
      if (seq === requestSeq.current) report(e);
    } finally {
      if (seq === requestSeq.current) {
        inFlight.current = false;
        if (live.current) setServerLoading(false);
      }
    }
  }, [activeId, historyPages, server, loadAttachment, report]);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      requestSeq.current++;
      for (const url of blobs.current.values()) URL.revokeObjectURL(url);
      blobs.current.clear();
    };
  }, []);
  useEffect(() => {
    setServerLoading(true);
    void refresh();
    const timer = window.setInterval(() => {
      if (!document.hidden && !inFlight.current) void refresh();
    }, 4000);
    const focus = () => {
      if (!document.hidden) void refresh();
    };
    window.addEventListener("focus", focus);
    window.addEventListener("online", focus);
    document.addEventListener("visibilitychange", focus);
    return () => {
      clearInterval(timer);
      requestSeq.current++;
      inFlight.current = false;
      window.removeEventListener("focus", focus);
      window.removeEventListener("online", focus);
      document.removeEventListener("visibilitychange", focus);
    };
  }, [refresh]);
  const savePreference = useCallback(
    async (conversation: string, data: Record<string, unknown>) => {
      await server("PATCH", "/preferences", { conversation, data });
      await refresh();
    },
    [server, refresh],
  );
  const setPreference = useCallback(
    (data: Record<string, unknown>) => {
      if (activeId) void savePreference(activeId, data).catch(report);
    },
    [activeId, savePreference, report],
  );
  const openChat = useCallback(
    (id: string) => {
      setActiveId(id);
      setHistoryPages(1);
      setHasMore(false);
      setDraft("");
      setUploadingFile(null);
      setMessageSearch("");
      setSearchOpen(false);
      setEmojiOpen(false);
      setContactPanelOpen(false);
      setReplyToMessage(null);
      setEditingMessage(null);
      if (chats.find((c) => c.id === id)?.hidden)
        void savePreference(id, { hidden: false }).catch(report);
    },
    [chats, savePreference, report],
  );
  const submitMessage = useCallback(
    async (
      conversation: string,
      text: string,
      file?: { name: string; url: string; size: number },
      replyTo?: string,
    ) => {
      let attachment: any;
      if (file) {
        if (file.size > 5242880) throw new Error("Limite de 5 MB por anexo.");
        const match = /^data:([^;,]+)(?:;[^,]*)?;base64,(.*)$/s.exec(file.url);
        if (!match) throw new Error("Anexo inválido.");
        attachment = {
          name: file.name,
          mime: match[1].split(";")[0],
          base64: match[2],
        };
      }
      const payload = { conversation, text, attachment, replyTo },
        signature = JSON.stringify(payload);
      if (pendingSend.current?.signature !== signature)
        pendingSend.current = { signature, id: crypto.randomUUID() };
      await server("POST", "/send", {
        ...payload,
        requestId: pendingSend.current.id,
      });
      pendingSend.current = null;
    },
    [server],
  );
  const sendMessage = useCallback(async () => {
    if (busySend.current || !activeId || (!draft.trim() && !uploadingFile))
      return;
    busySend.current = true;
    setSending(true);
    setServerError("");
    const selected = activeId,
      sent = draft;
    try {
      if (editingMessage)
        await server("PATCH", "/messages/" + editingMessage.id, {
          text: draft.trim(),
        });
      else
        await submitMessage(
          selected,
          draft.trim(),
          uploadingFile || undefined,
          replyToMessage?.id,
        );
      if (live.current && activeRef.current === selected) {
        setDraft((current) => (current === sent ? "" : current));
        setUploadingFile(null);
        setReplyToMessage(null);
        setEditingMessage(null);
        setEmojiOpen(false);
      }
      await refresh();
    } catch (e) {
      report(e);
    } finally {
      busySend.current = false;
      if (live.current) setSending(false);
    }
  }, [
    activeId,
    draft,
    uploadingFile,
    editingMessage,
    replyToMessage,
    server,
    submitMessage,
    refresh,
    report,
  ]);
  const createChat = useCallback(() => {
    const name = newName.trim().toLocaleLowerCase();
    const found = chats.filter(
      (c) =>
        c.type === "individual" &&
        (c.name.toLocaleLowerCase() === name ||
          c.phone?.toLocaleLowerCase() === name),
    );
    if (found.length !== 1) {
      report(
        new Error(
          "Seleccione um funcionário da lista de contactos da instituição.",
        ),
      );
      return;
    }
    openChat(found[0].id);
    setNewChatOpen(false);
    setNewName("");
    setSection("chats");
    setFilter("all");
    setSearch("");
  }, [newName, chats, openChat, report]);
  const createGroup = useCallback(async () => {
    if (
      busyGroup.current ||
      !newGroupName.trim() ||
      !selectedParticipants.length
    )
      return;
    busyGroup.current = true;
    try {
      const payload = {
        name: newGroupName.trim(),
        participants: selectedParticipants.map((id) => id.slice(2)),
      };
      const signature = JSON.stringify(payload);
      if (pendingGroup.current?.signature !== signature)
        pendingGroup.current = { signature, id: crypto.randomUUID() };
      const result = await server<{ id: string }>("POST", "/groups", {
        ...payload,
        requestId: pendingGroup.current.id,
      });
      pendingGroup.current = null;
      await refresh();
      openChat(result.id);
      setCreateGroupOpen(false);
      setNewGroupName("");
      setSelectedParticipants([]);
      notify(t("groupCreated"));
    } catch (e) {
      report(e);
    } finally {
      busyGroup.current = false;
    }
  }, [
    newGroupName,
    selectedParticipants,
    server,
    refresh,
    openChat,
    notify,
    t,
    report,
  ]);

  const handleMenuAction = useCallback(
    (action: string) => {
      setOptionsMenuOpen(false);
      switch (action) {
        case "contact":
          setContactPanelOpen(true);
          break;
        case "mute":
          setShowMuteOptions(true);
          break;
        case "wallpaper":
          setWallpaperPanelOpen(true);
          break;
        case "clear":
          if (activeId !== null) {
            setPreference({ clear: true });
          }
          break;
        case "delete":
          if (activeId !== null) {
            void savePreference(activeId, { clear: true, hidden: true })
              .then(() => {
                setActiveId(null);
                setContactPanelOpen(false);
                setWallpaperPanelOpen(false);
              })
              .catch(report);
          }
          break;
        case "search":
          setSearchOpen(true);
          break;
        case "media":
          setMediaGallery(true);
          break;
        case "stats":
          setStatsOpen(true);
          break;
        case "ai":
          window.dispatchEvent(new Event("nv:assistant-open"));
          break;
        case "help":
          notify(t("helpText"));
          break;
        default:
          notify(`${t("action")}: ${action}`);
      }
    },
    [
      activeId,
      notify,
      chats,
      openChat,
      t,
      setPreference,
      savePreference,
      report,
    ],
  );

  const applyWallpaper = useCallback(
    (wpId: string) => {
      setPreference({ wallpaper: wpId });
    },
    [setPreference],
  );
  const resetWallpaper = useCallback(() => {
    setPreference({ wallpaper: "" });
  }, [setPreference]);
  const handleReply = useCallback((message: Message) => {
    setReplyToMessage(message);
    setContextMenu(null);
    inputRef.current?.focus();
  }, []);

  const handleForward = useCallback((message: Message) => {
    setForwardTarget("");
    setForwardingMessage(message);
    setContextMenu(null);
  }, []);

  const handleEdit = useCallback((message: Message) => {
    setEditingMessage(message);
    setDraft(message.text);
    setContextMenu(null);
    inputRef.current?.focus();
  }, []);

  const handleDeleteMessage = useCallback(
    (messageId: string) => {
      void server("DELETE", "/messages/" + messageId)
        .then(refresh)
        .catch(report);
      setContextMenu(null);
    },
    [server, refresh, report],
  );
  const handleCopyMessage = useCallback(
    (message: Message) => {
      navigator.clipboard
        .writeText(message.text)
        .then(() => {
          notify(t("messageCopied"));
        })
        .catch(() => {
          notify("Erro ao copiar");
        });
      setContextMenu(null);
    },
    [notify, t],
  );

  const handleReaction = useCallback(
    (messageId: string, emoji: string) => {
      void server("POST", "/messages/" + messageId + "/reactions", { emoji })
        .then(refresh)
        .catch(report);
      setReactionPicker(null);
    },
    [server, refresh, report],
  );
  const handleMute = useCallback(
    (duration: number | null) => {
      setPreference({
        muted: duration !== null,
        mutedUntil: duration ? Date.now() + duration : 0,
      });
      setShowMuteOptions(false);
      setOptionsMenuOpen(false);
    },
    [setPreference],
  );
  const handleBlock = useCallback(() => {
    setPreference({ blocked: !activeChat?.blocked });
    setContactPanelOpen(false);
  }, [activeChat, setPreference]);
  const searchInChat = useCallback(
    (searchQuery: string) => {
      if (!searchQuery.trim() || activeId === null) {
        setSearchResults([]);
        setSearchIndex(0);
        return;
      }
      const results = currentMessages.filter((msg) =>
        msg.text.toLowerCase().includes(searchQuery.toLowerCase()),
      );
      setSearchResults(results);
      setSearchIndex(0);
    },
    [activeId, currentMessages],
  );

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > 5242880) {
        report(new Error("Limite de 5 MB por anexo."));
        e.target.value = "";
        return;
      }
      if (
        ![
          "image/png",
          "image/jpeg",
          "application/pdf",
          "text/plain",
          "audio/webm",
          "audio/ogg",
          "audio/mp4",
        ].includes(file.type)
      ) {
        report(
          new Error(
            "Formato não aceite. Utilize PDF, PNG, JPEG, TXT ou áudio WebM/OGG/MP4.",
          ),
        );
        e.target.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onerror = () =>
        report(new Error("Não foi possível ler o ficheiro."));
      reader.onload = (ev) => {
        const url = ev.target?.result as string;
        const type = file.type.startsWith("image/")
          ? "image"
          : file.type.startsWith("audio/")
            ? "audio"
            : file.type.startsWith("video/")
              ? "video"
              : "file";
        setUploadingFile({ name: file.name, type, url, size: file.size });
        notify(`${file.name} - ${t("fileLoaded")}`);
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    [notify, t, report],
  );

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ["audio/webm", "audio/ogg", "audio/mp4"].find((m) =>
        MediaRecorder.isTypeSupported(m),
      );
      const mediaRecorder = new MediaRecorder(
        stream,
        mime ? { mimeType: mime } : undefined,
      );
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
        if (
          audioChunksRef.current.reduce((n, b) => n + b.size, 0) > 5000000 &&
          mediaRecorder.state !== "inactive"
        )
          mediaRecorder.stop();
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType,
        });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return url;
        });
        setRecording(false);
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(1000);
      setRecording(true);
      setRecordingTime(0);

      recordingTimerRef.current = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      notify(t("recordingStarted"));
    } catch (err) {
      notify(t("micError"));
    }
  }, [notify, t]);

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    setRecording(false);
    notify(t("recordingFinished"));
  }, [notify, t]);

  const sendAudio = useCallback(async () => {
    if (!audioUrl || !activeId || busySend.current) return;
    busySend.current = true;
    setSending(true);
    try {
      const blob = await fetch(audioUrl).then((r) => r.blob());
      const url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Falha ao ler áudio."));
        reader.readAsDataURL(blob);
      });
      await submitMessage(activeId, t("voiceMessage"), {
        name: "Mensagem de voz",
        url,
        size: blob.size,
      });
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
      setRecordingTime(0);
      await refresh();
    } catch (e) {
      report(e);
    } finally {
      busySend.current = false;
      if (live.current) setSending(false);
    }
  }, [audioUrl, activeId, submitMessage, t, refresh, report]);
  const startCall = useCallback(
    async (type: "voice" | "video") => {
      if (!activeChat?.id.startsWith("d:")) {
        notify("Seleccione um colega. As chamadas são individuais.");
        return;
      }
      inviteCall({
        peer: activeChat.id.slice(2),
        name: activeChat.name,
        kind: type,
      });
    },
    [activeChat, notify],
  );

  useEffect(
    () => () => {
      const recorder = mediaRecorderRef.current;
      if (recorder) {
        recorder.onstop = null;
        if (recorder.state !== "inactive") recorder.stop();
        recorder.stream.getTracks().forEach((track) => track.stop());
      }
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    },
    [],
  );
  const endCall = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
    }
    setCallActive(false);
    setCallDuration(0);
    notify(t("callEnded"));
  }, [notify, t]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !callMuted;
      });
    }
    setCallMuted((prev) => !prev);
  }, [callMuted]);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !callVideoOff;
      });
    }
    setCallVideoOff((prev) => !prev);
  }, [callVideoOff]);

  const requestNotifications = useCallback(() => {
    if (!("Notification" in window)) {
      notify(t("notificationsNotSupported"));
      return;
    }
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        setNotificationsEnabled(true);
        notify(t("notificationsGranted"));
      } else {
        notify(t("notificationsDenied"));
      }
    });
  }, [notify, t]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const area = messagesRef.current;
    if (area) area.scrollTop = area.scrollHeight;
  }, [activeId, messages[activeId || ""]?.at(-1)?.id]);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element) {
        if (!target.closest(".composer")) setEmojiOpen(false);
        if (!target.closest(".options-menu-container"))
          setOptionsMenuOpen(false);
        if (!target.closest(".context-menu")) setContextMenu(null);
        if (!target.closest(".reaction-picker")) setReactionPicker(null);
        if (!target.closest(".language-menu-container"))
          setLanguageMenuOpen(false);
      }
    };
    const root = rootRef.current;
    root?.addEventListener("pointerdown", close);
    return () => root?.removeEventListener("pointerdown", close);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOptionsMenuOpen(false);
        setEmojiOpen(false);
        setContextMenu(null);
        setContactPanelOpen(false);
        setWallpaperPanelOpen(false);
        setReactionPicker(null);
        setShowMuteOptions(false);
        setMediaGallery(false);
        setStatsOpen(false);
        setCreateGroupOpen(false);
        setLanguageMenuOpen(false);
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const formatCallDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const languageFlags: Record<Language, string> = { pt: "🇹", en: "🇬", fr: "" };

  return (
    <div ref={rootRef} className={`laicisa-chat${dark ? " chat-dark" : ""}`}>
      <style>
        {CHAT_CSS +
          "\n.laicisa-chat{height:calc(100dvh - 130px);min-height:480px;position:relative}.laicisa-chat .server-notice{position:absolute;z-index:10;left:80px;right:12px;top:0;padding:8px 12px;background:#fff1f2;color:#9f1239;border:1px solid #fecdd3;font-size:13px}.laicisa-chat .server-notice button{margin-left:12px;text-decoration:underline;background:none;border:0;cursor:pointer}"}
      </style>
      {(serverError || sending || serverLoading) && (
        <div className="server-notice" role={serverError ? "alert" : "status"}>
          {serverError ||
            (sending ? "A guardar no servidor…" : "A carregar conversas…")}
          {serverError && (
            <button type="button" onClick={() => void refresh()}>
              Tentar novamente
            </button>
          )}
        </div>
      )}

      <div className="app-wrapper">
        <nav
          className="navbar"
          role="navigation"
          aria-label="Navegação principal"
        >
          <div className="nav-logo" title={appTitle} aria-label={appTitle}>
            <Icon.WhatsApp width={32} height={32} />
          </div>
          <div className="nav-items">
            <button
              data-tab="chats"
              title={t("conversations")}
              className={`nav-item${section === "chats" ? " active" : ""}`}
              onClick={() => {
                setSection("chats");
                setActiveId(null);
              }}
              type="button"
            >
              <Icon.Chat width={24} height={24} />
              <span className={`nav-badge${totalUnread ? "" : " hidden"}`}>
                {totalUnread || null}
              </span>
            </button>
            <button
              data-tab="calls"
              title={t("calls")}
              className={`nav-item${section === "calls" ? " active" : ""}`}
              onClick={() => {
                setSection("calls");
                setActiveId(null);
              }}
              type="button"
            >
              <Icon.Phone width={24} height={24} />
            </button>
            <button
              data-tab="status"
              title={t("status")}
              className={`nav-item${section === "status" ? " active" : ""}`}
              onClick={() => {
                setSection("status");
                setActiveId(null);
              }}
              type="button"
            >
              <Icon.Status width={24} height={24} />
            </button>
            <button
              data-tab="channels"
              title={t("channels")}
              className={`nav-item${section === "channels" ? " active" : ""}`}
              onClick={() => {
                setSection("channels");
                setActiveId(null);
              }}
              type="button"
            >
              <Icon.Channel width={24} height={24} />
            </button>
            <button
              data-tab="communities"
              title={t("communities")}
              className={`nav-item${section === "communities" ? " active" : ""}`}
              onClick={() => {
                setSection("communities");
                setActiveId(null);
              }}
              type="button"
            >
              <Icon.Community width={24} height={24} />
            </button>
          </div>
          <div className="nav-footer">
            <button className="nav-item" type="button"
              title={`${t("theme")}: ${dark ? t("light") : t("dark")}`}
              aria-label={`${t("theme")}: ${dark ? t("light") : t("dark")}`}
              onClick={() => void savePreference("settings", { dark: !dark })
                .then(() => setDark(!dark)).catch(report)}>
              {dark ? <Icon.Sun width={23} height={23} /> : <Icon.Moon width={23} height={23} />}
            </button>
            <button
              className="nav-item"
              title={t("metaAI")}
              onClick={() => {
                window.dispatchEvent(new Event("nv:assistant-open"));
              }}
              type="button"
            >
              <Icon.Bot width={24} height={24} />
            </button>
            <div
              className="nav-avatar"
              title={t("profile")}
              onClick={() =>
                notify(
                  session?.funcionarioNome || session?.username || t("profile"),
                )
              }
              role="button"
              tabIndex={0}
            >
              {initial(session?.funcionarioNome || session?.username || "EU")}
            </div>
          </div>
        </nav>

        <div
          id="mainPanel"
          className={`main-panel${activeId !== null ? " hide-on-mobile" : ""}`}
        >
          <div
            data-tab-content="chats"
            className={`tab-content${section === "chats" ? " active" : ""}`}
          >
            <div className="panel-header">
              <h1 className="panel-title">{t("conversations")}</h1>
              <div className="header-actions">
                <button
                  className="icon-btn"
                  title={t("newGroup")}
                  onClick={() => setCreateGroupOpen(true)}
                  type="button"
                >
                  <Icon.Users width={20} height={20} />
                </button>
                <button
                  className="icon-btn"
                  title={t("newConversation")}
                  onClick={() => setNewChatOpen(true)}
                  type="button"
                >
                  <Icon.Plus width={20} height={20} />
                </button>
              </div>
            </div>
            <div className="search-box">
              <div className="search-input-wrap">
                <Icon.Search width={18} height={18} />
                <input
                  type="text"
                  className="search-input"
                  placeholder={t("searchPlaceholder")}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <button
                  title={t("clear")}
                  className={`search-clear${search ? " show" : ""}`}
                  onClick={() => setSearch("")}
                  type="button"
                >
                  <Icon.X width={16} height={16} />
                </button>
              </div>
            </div>
            <div className="filters">
              <button
                className={`filter-btn${filter === "all" ? " active" : ""}`}
                onClick={() => setFilter("all")}
                type="button"
              >
                <Icon.Filter
                  width={12}
                  height={12}
                  style={{
                    display: "inline",
                    marginRight: 4,
                    verticalAlign: "middle",
                  }}
                />
                {t("all")}
              </button>
              <button
                className={`filter-btn${filter === "unread" ? " active" : ""}`}
                onClick={() => setFilter("unread")}
                type="button"
              >
                <Icon.Bell
                  width={12}
                  height={12}
                  style={{
                    display: "inline",
                    marginRight: 4,
                    verticalAlign: "middle",
                  }}
                />
                {t("unread")}{" "}
                <span style={{ opacity: ".7" }}>{totalUnread}</span>
              </button>
              <button
                className={`filter-btn${filter === "favorites" ? " active" : ""}`}
                onClick={() => setFilter("favorites")}
                type="button"
              >
                <Icon.Star
                  width={12}
                  height={12}
                  style={{
                    display: "inline",
                    marginRight: 4,
                    verticalAlign: "middle",
                  }}
                />
                {t("favorites")}
              </button>
              <button
                className={`filter-btn${filter === "groups" ? " active" : ""}`}
                onClick={() => setFilter("groups")}
                type="button"
              >
                <Icon.Users
                  width={12}
                  height={12}
                  style={{
                    display: "inline",
                    marginRight: 4,
                    verticalAlign: "middle",
                  }}
                />
                {t("groups")}
              </button>
            </div>
            <div className="chat-list">
              <div
                className="archived-btn"
                onClick={() => notify(t("archivedEmpty"))}
                role="button"
                tabIndex={0}
              >
                <Icon.Archive width={24} height={24} />
                <span>{t("archived")}</span>
                <span className="archived-count">0</span>
              </div>
              <div className="section-header">{t("recent")}</div>
              {visibleChats.length === 0 ? (
                <div className="no-results">
                  <Icon.Search
                    width={48}
                    height={48}
                    style={{ opacity: 0.3, marginBottom: 16 }}
                  />
                  <p>{t("noResults")}</p>
                </div>
              ) : (
                visibleChats.map((chat) => (
                  <button
                    type="button"
                    key={chat.id}
                    onClick={() => openChat(chat.id)}
                    className={`chat-item${chat.unread ? " unread" : ""}${activeId === chat.id ? " active" : ""}`}
                  >
                    <div className={`chat-avatar av-${chat.av}`}>
                      {initial(chat.name)}
                    </div>
                    <div className="chat-info">
                      <div className="chat-top">
                        <span className="chat-name">
                          {chat.pinned && (
                            <Icon.Pin
                              width={12}
                              height={12}
                              style={{
                                display: "inline",
                                marginRight: 4,
                                color: "var(--dashboard-blue)",
                              }}
                            />
                          )}
                          {chat.name}
                          {chat.muted && (
                            <Icon.BellOff
                              width={12}
                              height={12}
                              style={{
                                display: "inline",
                                marginLeft: 4,
                                color: "var(--dashboard-gray)",
                              }}
                            />
                          )}
                          {chat.type === "group" && (
                            <Icon.Users
                              width={12}
                              height={12}
                              style={{
                                display: "inline",
                                marginLeft: 4,
                                color: "var(--dashboard-gray)",
                              }}
                            />
                          )}
                        </span>
                        <span className="chat-time">{chat.time}</span>
                      </div>
                      <div className="chat-bottom">
                        <span className="chat-preview">
                          {chat.call && <Icon.Phone width={14} height={14} />}
                          {chat.preview}
                        </span>
                        {chat.unread > 0 && (
                          <span className="unread-badge">{chat.unread}</span>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
            <div className="e2e-message">
              <Icon.Lock width={14} height={14} />
              <span>{t("e2eMessage")}</span>
            </div>
          </div>

          <div
            data-tab-content="calls"
            className={`tab-content${section === "calls" ? " active" : ""}`}
          >
            <div className="panel-header">
              <h1 className="panel-title">{t("calls")}</h1>
            </div>
            {section === "calls" && (
              <div className="chat-list">
                <CallHistory username={session?.username} />
              </div>
            )}
          </div>
          <div
            data-tab-content="status"
            className={`tab-content${section === "status" ? " active" : ""}`}
          >
            <div className="panel-header">
              <h1 className="panel-title">{t("status")}</h1>
            </div>
            {section === "status" && (
              <ChatSocial
                key="status"
                kind="status"
                username={session?.username}
              />
            )}
          </div>
          <div
            data-tab-content="channels"
            className={`tab-content${section === "channels" ? " active" : ""}`}
          >
            <div className="panel-header">
              <h1 className="panel-title">{t("channels")}</h1>
            </div>
            {section === "channels" && (
              <ChatSocial
                key="channels"
                kind="channel"
                username={session?.username}
              />
            )}
          </div>
          <div
            data-tab-content="communities"
            className={`tab-content${section === "communities" ? " active" : ""}`}
          >
            <div className="panel-header">
              <h1 className="panel-title">{t("communities")}</h1>
            </div>
            {section === "communities" && (
              <ChatSocial
                key="communities"
                kind="community"
                username={session?.username}
              />
            )}
          </div>
        </div>

        <div
          id="chatView"
          className={`chat-view${activeId !== null ? " active" : ""}`}
        >
          <div
            className="empty-state"
            style={{ display: activeChat ? "none" : undefined }}
          >
            <div className="empty-state-icon">
              <svg viewBox="0 0 303 172">
                <path
                  d="M229.565 160.229c27.762-15.17 46.774-44.78 46.774-78.78 0-49.706-40.294-90-90-90s-90 40.294-90 90c0 27.762 12.556 52.58 32.302 69.09L105 172l32.302-21.461c11.028 5.04 23.29 7.847 36.198 7.847 19.88 0 38.44-6.28 53.625-17.03l2.44-1.127z"
                  fill="currentColor"
                  opacity=".15"
                ></path>
                <circle
                  cx="140"
                  cy="80"
                  r="6"
                  fill="currentColor"
                  opacity=".3"
                ></circle>
                <circle
                  cx="170"
                  cy="80"
                  r="6"
                  fill="currentColor"
                  opacity=".3"
                ></circle>
                <circle
                  cx="200"
                  cy="80"
                  r="6"
                  fill="currentColor"
                  opacity=".3"
                ></circle>
              </svg>
            </div>
            <h2>{t("chatApp")}</h2>
            <p>{t("chatAppSubtitle")}</p>
          </div>

          <div
            style={{
              display: activeChat ? "flex" : "none",
              flex: 1,
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            {searchOpen && (
              <div
                style={{
                  padding: "8px 16px",
                  background: "var(--dashboard-blue)",
                  borderBottom: "2px solid var(--dashboard-blue-dark)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Icon.Search
                  width={18}
                  height={18}
                  style={{ color: "white" }}
                />
                <input
                  type="text"
                  placeholder={t("searchInChat")}
                  value={messageSearch}
                  onChange={(e) => {
                    setMessageSearch(e.target.value);
                    searchInChat(e.target.value);
                  }}
                  style={{
                    flex: 1,
                    border: "none",
                    background: "white",
                    padding: "6px 12px",
                    borderRadius: 4,
                    outline: "none",
                  }}
                  autoFocus
                />
                {searchResults.length > 0 && (
                  <span
                    style={{ color: "white", fontSize: 12, fontWeight: 600 }}
                  >
                    {searchIndex + 1} / {searchResults.length}
                  </span>
                )}
                <button
                  onClick={() => {
                    setSearchOpen(false);
                    setMessageSearch("");
                    setSearchResults([]);
                  }}
                  style={{
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    color: "white",
                  }}
                >
                  <Icon.X width={18} height={18} />
                </button>
              </div>
            )}

            <div className="chat-view-header">
              <button
                className="icon-btn back-btn"
                title={t("back")}
                onClick={() => {
                  setActiveId(null);
                  setContactPanelOpen(false);
                }}
                type="button"
              >
                <Icon.ArrowLeft width={20} height={20} />
              </button>

              <div className={`chat-view-avatar av-${activeChat?.av ?? 1}`}>
                {activeChat ? initial(activeChat.name) : ""}
              </div>

              <div
                className="chat-view-info"
                onClick={() => setContactPanelOpen(true)}
                style={{ cursor: "pointer" }}
              >
                <div className="chat-view-name">
                  {activeChat?.name}
                  {activeChat?.muted && (
                    <Icon.BellOff
                      width={12}
                      height={12}
                      style={{ display: "inline", marginLeft: 6 }}
                    />
                  )}
                  {activeChat?.type === "group" && (
                    <Icon.Users
                      width={12}
                      height={12}
                      style={{ display: "inline", marginLeft: 6 }}
                    />
                  )}
                </div>
                <div className="chat-view-status">
                  {activeChat?.blocked
                    ? `🚫 ${t("blocked")}`
                    : activeChat?.type === "group"
                      ? `${(activeChat.participants?.length || 0) + 1} ${t("participants")}`
                      : "Contacto da instituição"}
                </div>
              </div>

              <div className="chat-view-actions">
                <button
                  className="icon-btn"
                  title={t("videoCall")}
                  onClick={() => startCall("video")}
                  type="button"
                >
                  <Icon.Video width={20} height={20} />
                </button>
                <button
                  className="icon-btn"
                  title={t("voiceCall")}
                  onClick={() => startCall("voice")}
                  type="button"
                >
                  <Icon.Phone width={20} height={20} />
                </button>
                <button
                  className="icon-btn"
                  title={t("statistics")}
                  onClick={() => setStatsOpen(true)}
                  type="button"
                >
                  <Icon.BarChart width={20} height={20} />
                </button>
                <button
                  className="icon-btn"
                  title={t("searchInChat")}
                  onClick={() => setSearchOpen((value) => !value)}
                  type="button"
                >
                  <Icon.Search width={20} height={20} />
                </button>

                <div
                  className="language-menu-container"
                  style={{ position: "relative" }}
                >
                  <button
                    className="icon-btn"
                    title={t("selectLanguage")}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLanguageMenuOpen(!languageMenuOpen);
                    }}
                    style={{ fontSize: 14, fontWeight: 700 }}
                  >
                    {languageFlags[language]}
                  </button>

                  {languageMenuOpen && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 4px)",
                        right: 0,
                        minWidth: 160,
                        background: "var(--WDS-surface-default)",
                        border: "1px solid var(--WDS-lines-divider)",
                        borderRadius: 8,
                        boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                        zIndex: 50,
                        overflow: "hidden",
                        padding: "4px 0",
                      }}
                    >
                      {(["pt", "en", "fr"] as Language[]).map((lang) => (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => {
                            void savePreference("settings", { language: lang })
                              .then(() => setLanguage(lang))
                              .catch(report);
                            setLanguageMenuOpen(false);
                            notify(
                              `${languageFlags[lang]} ${TRANSLATIONS[lang].language}`,
                            );
                          }}
                          style={{
                            width: "100%",
                            padding: "10px 16px",
                            border: "none",
                            background:
                              language === lang
                                ? "var(--WDS-warm-gray-300-alpha-15)"
                                : "transparent",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            color: "var(--WDS-content-default)",
                            fontSize: 14,
                            fontWeight: language === lang ? 700 : 400,
                            textAlign: "left",
                          }}
                          onMouseEnter={(e) => {
                            if (language !== lang)
                              e.currentTarget.style.background =
                                "var(--WDS-warm-gray-300-alpha-15)";
                          }}
                          onMouseLeave={(e) => {
                            if (language !== lang)
                              e.currentTarget.style.background = "transparent";
                          }}
                        >
                          <span style={{ fontSize: 18 }}>
                            {languageFlags[lang]}
                          </span>
                          <span>{TRANSLATIONS[lang].language as string}</span>
                          {language === lang && (
                            <Icon.Check
                              width={16}
                              height={16}
                              style={{
                                marginLeft: "auto",
                                color: "var(--dashboard-blue)",
                              }}
                            />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div
                  className="options-menu-container"
                  style={{ position: "relative" }}
                >
                  <button
                    className="icon-btn"
                    title={t("moreOptions")}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOptionsMenuOpen(!optionsMenuOpen);
                    }}
                    aria-expanded={optionsMenuOpen}
                  >
                    <Icon.MoreVertical width={20} height={20} />
                  </button>

                  {optionsMenuOpen && (
                    <div
                      ref={optionsMenuRef}
                      style={{
                        position: "absolute",
                        top: "calc(100% + 4px)",
                        right: 0,
                        minWidth: 240,
                        background: "var(--WDS-surface-default)",
                        border: "1px solid var(--WDS-lines-divider)",
                        borderRadius: 8,
                        boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                        zIndex: 50,
                        overflow: "hidden",
                        padding: "4px 0",
                      }}
                      role="menu"
                    >
                      <button
                        type="button"
                        onClick={() => handleMenuAction("contact")}
                        style={{
                          width: "100%",
                          padding: "10px 16px",
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          color: "var(--WDS-content-default)",
                          fontSize: 14,
                          textAlign: "left",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background =
                            "var(--WDS-warm-gray-300-alpha-15)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "transparent")
                        }
                        role="menuitem"
                      >
                        <Icon.Contact
                          width={18}
                          height={18}
                          style={{ color: "var(--WDS-neutral-gray-500)" }}
                        />
                        <span>{t("viewContact")}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleMenuAction("mute")}
                        style={{
                          width: "100%",
                          padding: "10px 16px",
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          color: "var(--WDS-content-default)",
                          fontSize: 14,
                          textAlign: "left",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background =
                            "var(--WDS-warm-gray-300-alpha-15)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "transparent")
                        }
                        role="menuitem"
                      >
                        <Icon.BellOff
                          width={18}
                          height={18}
                          style={{ color: "var(--WDS-neutral-gray-500)" }}
                        />
                        <span>
                          {activeChat?.muted
                            ? t("unmuteNotifications")
                            : t("muteNotifications")}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleMenuAction("wallpaper")}
                        style={{
                          width: "100%",
                          padding: "10px 16px",
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          color: "var(--WDS-content-default)",
                          fontSize: 14,
                          textAlign: "left",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background =
                            "var(--WDS-warm-gray-300-alpha-15)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "transparent")
                        }
                        role="menuitem"
                      >
                        <Icon.Palette
                          width={18}
                          height={18}
                          style={{ color: "var(--WDS-neutral-gray-500)" }}
                        />
                        <span>{t("wallpaper")}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleMenuAction("media")}
                        style={{
                          width: "100%",
                          padding: "10px 16px",
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          color: "var(--WDS-content-default)",
                          fontSize: 14,
                          textAlign: "left",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background =
                            "var(--WDS-warm-gray-300-alpha-15)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "transparent")
                        }
                        role="menuitem"
                      >
                        <Icon.Image
                          width={18}
                          height={18}
                          style={{ color: "var(--WDS-neutral-gray-500)" }}
                        />
                        <span>{t("mediaGallery")}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleMenuAction("stats")}
                        style={{
                          width: "100%",
                          padding: "10px 16px",
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          color: "var(--WDS-content-default)",
                          fontSize: 14,
                          textAlign: "left",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background =
                            "var(--WDS-warm-gray-300-alpha-15)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "transparent")
                        }
                        role="menuitem"
                      >
                        <Icon.BarChart
                          width={18}
                          height={18}
                          style={{ color: "var(--WDS-neutral-gray-500)" }}
                        />
                        <span>{t("statistics")}</span>
                      </button>

                      <div
                        style={{
                          height: 1,
                          background: "var(--WDS-lines-divider)",
                          margin: "4px 0",
                        }}
                      />

                      <button
                        type="button"
                        onClick={() => handleMenuAction("search")}
                        style={{
                          width: "100%",
                          padding: "10px 16px",
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          color: "var(--WDS-content-default)",
                          fontSize: 14,
                          textAlign: "left",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background =
                            "var(--WDS-warm-gray-300-alpha-15)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "transparent")
                        }
                        role="menuitem"
                      >
                        <Icon.Search
                          width={18}
                          height={18}
                          style={{ color: "var(--WDS-neutral-gray-500)" }}
                        />
                        <span>{t("searchInChat")}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleMenuAction("clear")}
                        style={{
                          width: "100%",
                          padding: "10px 16px",
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          color: "var(--WDS-content-default)",
                          fontSize: 14,
                          textAlign: "left",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background =
                            "var(--WDS-warm-gray-300-alpha-15)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "transparent")
                        }
                        role="menuitem"
                      >
                        <Icon.Trash
                          width={18}
                          height={18}
                          style={{ color: "var(--WDS-neutral-gray-500)" }}
                        />
                        <span>{t("clearMessages")}</span>
                      </button>

                      <div
                        style={{
                          height: 1,
                          background: "var(--WDS-lines-divider)",
                          margin: "4px 0",
                        }}
                      />

                      <button
                        type="button"
                        onClick={() => handleMenuAction("delete")}
                        style={{
                          width: "100%",
                          padding: "10px 16px",
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          color: "#E84C3D",
                          fontSize: 14,
                          textAlign: "left",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background =
                            "rgba(232, 76, 61, 0.08)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "transparent")
                        }
                        role="menuitem"
                      >
                        <Icon.Trash width={18} height={18} />
                        <span>{t("deleteConversation")}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleMenuAction("help")}
                        style={{
                          width: "100%",
                          padding: "10px 16px",
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          color: "var(--WDS-content-default)",
                          fontSize: 14,
                          textAlign: "left",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background =
                            "var(--WDS-warm-gray-300-alpha-15)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "transparent")
                        }
                        role="menuitem"
                      >
                        <Icon.HelpCircle
                          width={18}
                          height={18}
                          style={{ color: "var(--WDS-neutral-gray-500)" }}
                        />
                        <span>{t("help")}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div
              className="messages-area"
              ref={messagesRef}
              aria-live="polite"
              style={{
                backgroundColor: currentWallpaper.type === "solid"
                  ? currentWallpaper.value : "var(--WDS-background-wash-inset)",
                backgroundImage: currentWallpaper.type === "solid" ? "none" : currentWallpaper.value,
                backgroundSize: currentWallpaper.size || (currentWallpaper.type === "image" ? "cover" : "auto"),
                backgroundRepeat:
                  currentWallpaper.type === "pattern" ? "repeat" : "no-repeat",
                "--nv-chat-sent-background": currentBubble.color,
                "--nv-chat-sent-text": currentBubble.text,
              } as React.CSSProperties}
            >
              <div className="date-separator">{t("conversations")}</div>
              {hasMore && (
                <button
                  type="button"
                  onClick={() => setHistoryPages((p) => p + 1)}
                  style={{ display: "block", margin: "8px auto", padding: 8 }}
                >
                  Carregar mensagens anteriores
                </button>
              )}
              {currentMessages
                .filter(
                  (message) =>
                    !messageSearch ||
                    message.text
                      .toLowerCase()
                      .includes(messageSearch.toLowerCase()),
                )
                .map((message) => {
                  const repliedMessage = message.replyTo
                    ? currentMessages.find((m) => m.id === message.replyTo)
                    : null;
                  const isHighlighted = searchResults.includes(message);
                  return (
                    <div
                      key={message.id}
                      className={`message ${message.type}${message.aiGenerated ? " ai" : ""}`}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          messageId: message.id,
                        });
                      }}
                      style={{
                        cursor: "context-menu",
                        border: isHighlighted
                          ? "2px solid var(--dashboard-yellow)"
                          : undefined,
                        opacity: message.deleted ? 0.6 : 1,
                      }}
                    >
                      {message.aiGenerated && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            marginBottom: 4,
                            fontSize: 11,
                            opacity: 0.8,
                          }}
                        >
                          <Icon.Bot width={12} height={12} />
                          <span>{t("aiBadge")}</span>
                        </div>
                      )}
                      {repliedMessage && (
                        <div
                          style={{
                            borderLeft: "3px solid var(--dashboard-blue)",
                            padding: "4px 8px",
                            marginBottom: 4,
                            background: "rgba(0,0,0,0.05)",
                            borderRadius: 4,
                            fontSize: 12,
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 600,
                              color: "var(--dashboard-blue)",
                            }}
                          >
                            {repliedMessage.type === "sent"
                              ? t("you")
                              : activeChat?.name}
                          </div>
                          <div
                            style={{
                              color: "var(--WDS-content-deemphasized)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {repliedMessage.text}
                          </div>
                        </div>
                      )}
                      {activeChat?.type === "group" && (
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            marginBottom: 4,
                          }}
                        >
                          {message.senderName}
                        </div>
                      )}
                      {message.attachment && (
                        <div style={{ marginBottom: 6 }}>
                          {message.attachment.type === "image" ? (
                            <img
                              src={message.attachment.url}
                              alt={message.attachment.name}
                              style={{
                                maxWidth: 200,
                                borderRadius: 8,
                                cursor: "pointer",
                              }}
                              onClick={() =>
                                window.open(message.attachment!.url, "_blank")
                              }
                            />
                          ) : message.attachment.type === "audio" ? (
                            <audio
                              controls
                              src={message.attachment.url}
                              style={{ maxWidth: 200 }}
                            />
                          ) : (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                padding: 8,
                                background: "rgba(0,0,0,0.05)",
                                borderRadius: 6,
                              }}
                            >
                              <Icon.File width={24} height={24} />
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600 }}>
                                  {message.attachment.name}
                                </div>
                                <div style={{ fontSize: 11, opacity: 0.7 }}>
                                  {formatFileSize(message.attachment.size)}
                                </div>
                              </div>
                              <a
                                href={message.attachment.url}
                                download={message.attachment.name}
                                style={{ marginLeft: "auto" }}
                              >
                                <Icon.Download width={18} height={18} />
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                      {message.audio && (
                        <div
                          style={{
                            marginBottom: 6,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <audio
                            controls
                            src={message.audio.url}
                            style={{ maxWidth: 200 }}
                          />
                          <span style={{ fontSize: 11, opacity: 0.7 }}>
                            {message.audio.duration}s
                          </span>
                        </div>
                      )}
                      <div className="message-text">{message.text}</div>
                      {message.reactions &&
                        Object.keys(message.reactions).length > 0 && (
                          <div
                            style={{
                              position: "absolute",
                              bottom: -10,
                              right: 8,
                              display: "flex",
                              gap: 2,
                              background: "white",
                              borderRadius: 12,
                              padding: "2px 6px",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                              fontSize: 14,
                            }}
                          >
                            {Object.entries(message.reactions).map(
                              ([emoji, users]) => (
                                <span key={emoji} style={{ cursor: "pointer" }}>
                                  {emoji} {users.length}
                                </span>
                              ),
                            )}
                          </div>
                        )}
                      <div className="message-meta">
                        {message.edited && (
                          <span style={{ marginRight: 4, fontSize: 10 }}>
                            {t("edited")}
                          </span>
                        )}
                        {message.time}
                        {message.type === "sent" && (
                          <span
                            title={
                              message.read ? "Lida" : "Guardada no servidor"
                            }
                          >
                            {message.read ? " ✓✓" : " ✓"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>

            {replyToMessage && (
              <div
                style={{
                  padding: "8px 16px",
                  background: "var(--dashboard-blue)",
                  borderTop: "1px solid var(--dashboard-blue-dark)",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    borderLeft: "3px solid white",
                    padding: "4px 8px",
                    flex: 1,
                    background: "rgba(255,255,255,0.1)",
                    borderRadius: 4,
                  }}
                >
                  <div
                    style={{ fontWeight: 600, color: "white", fontSize: 12 }}
                  >
                    {t("replyTo")}{" "}
                    {replyToMessage.type === "sent"
                      ? t("yourself")
                      : activeChat?.name}
                  </div>
                  <div
                    style={{
                      color: "rgba(255,255,255,0.8)",
                      fontSize: 12,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {replyToMessage.text}
                  </div>
                </div>
                <button
                  onClick={() => setReplyToMessage(null)}
                  style={{
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    color: "white",
                  }}
                >
                  <Icon.X width={18} height={18} />
                </button>
              </div>
            )}

            {editingMessage && (
              <div
                style={{
                  padding: "8px 16px",
                  background: "var(--dashboard-orange)",
                  borderTop: "1px solid var(--dashboard-blue-dark)",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <Icon.Edit width={18} height={18} style={{ color: "white" }} />
                <div style={{ flex: 1 }}>
                  <div
                    style={{ fontWeight: 600, color: "white", fontSize: 12 }}
                  >
                    {t("editingMessage")}
                  </div>
                  <div
                    style={{
                      color: "rgba(255,255,255,0.8)",
                      fontSize: 12,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {editingMessage.text}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setEditingMessage(null);
                    setDraft("");
                  }}
                  style={{
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    color: "white",
                  }}
                >
                  <Icon.X width={18} height={18} />
                </button>
              </div>
            )}

            {uploadingFile && (
              <div
                style={{
                  padding: "8px 16px",
                  background: "var(--dashboard-green)",
                  borderTop: "1px solid var(--dashboard-blue-dark)",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                {uploadingFile.type === "image" ? (
                  <Icon.Image
                    width={18}
                    height={18}
                    style={{ color: "white" }}
                  />
                ) : (
                  <Icon.File
                    width={18}
                    height={18}
                    style={{ color: "white" }}
                  />
                )}
                <div style={{ flex: 1 }}>
                  <div
                    style={{ fontWeight: 600, color: "white", fontSize: 12 }}
                  >
                    {uploadingFile.name}
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 11 }}>
                    {formatFileSize(uploadingFile.size)}
                  </div>
                </div>
                <button
                  onClick={() => setUploadingFile(null)}
                  style={{
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    color: "white",
                  }}
                >
                  <Icon.X width={18} height={18} />
                </button>
              </div>
            )}

            {audioUrl && !recording && (
              <div
                style={{
                  padding: "8px 16px",
                  background: "var(--dashboard-blue-chart)",
                  borderTop: "1px solid var(--dashboard-blue-dark)",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <Icon.Mic width={18} height={18} style={{ color: "white" }} />
                <div style={{ flex: 1 }}>
                  <div
                    style={{ fontWeight: 600, color: "white", fontSize: 12 }}
                  >
                    {t("voiceMessage")} ({recordingTime}s)
                  </div>
                  <audio
                    controls
                    src={audioUrl}
                    style={{ maxWidth: 200, marginTop: 4 }}
                  />
                </div>
                <button
                  onClick={() => setAudioUrl(null)}
                  style={{
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    color: "white",
                    marginRight: 8,
                  }}
                  title={t("cancel")}
                >
                  <Icon.X width={18} height={18} />
                </button>
                <button
                  onClick={sendAudio}
                  style={{
                    border: "none",
                    background: "var(--dashboard-green)",
                    color: "white",
                    cursor: "pointer",
                    padding: "6px 12px",
                    borderRadius: 16,
                    fontWeight: 600,
                    fontSize: 12,
                  }}
                  title={t("send")}
                >
                  <Icon.Send width={14} height={14} />
                </button>
              </div>
            )}

            <div className="composer">
              <button
                className="icon-btn"
                title={t("emoji")}
                onClick={() => setEmojiOpen((value) => !value)}
                aria-expanded={emojiOpen}
                type="button"
              >
                <Icon.Smile width={20} height={20} />
              </button>
              <button
                className="icon-btn"
                title={t("attachmentRequiresService")}
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                <Icon.Paperclip width={20} height={20} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,application/pdf,text/plain,audio/webm,audio/ogg,audio/mp4"
                style={{ display: "none" }}
                onChange={handleFileUpload}
              />

              {recording ? (
                <button
                  className="icon-btn"
                  title={t("recordingFinished")}
                  onClick={stopRecording}
                  type="button"
                  style={{ background: "var(--dashboard-red)" }}
                >
                  <Icon.Stop width={20} height={20} />
                </button>
              ) : (
                <button
                  className="icon-btn"
                  title={t("audioRequiresService")}
                  onClick={startRecording}
                  type="button"
                >
                  <Icon.Mic width={20} height={20} />
                </button>
              )}

              <div className="composer-input-wrap">
                <input
                  type="text"
                  className="composer-input"
                  placeholder={
                    recording
                      ? `${t("recording")} ${formatCallDuration(recordingTime)}`
                      : editingMessage
                        ? t("editingMessage") + "..."
                        : replyToMessage
                          ? t("replyTo") + "..."
                          : t("writeMessage")
                  }
                  ref={inputRef}
                  value={draft}
                  disabled={recording || sending}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      void sendMessage();
                    }
                  }}
                />
              </div>
              <button
                className="icon-btn send-btn"
                title={t("send")}
                onClick={sendMessage}
                disabled={
                  sending ||
                  (!draft.trim() && !uploadingFile) ||
                  !activeChat ||
                  recording
                }
                type="button"
              >
                <Icon.Send width={20} height={20} />
              </button>

              {emojiOpen && (
                <div
                  ref={emojiPickerRef}
                  style={{
                    position: "absolute",
                    bottom: 70,
                    left: 8,
                    width: 360,
                    height: 420,
                    background: "var(--WDS-surface-default)",
                    border: "1px solid var(--WDS-lines-divider)",
                    borderRadius: 12,
                    boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
                    zIndex: 20,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      padding: "8px 12px",
                      borderBottom: "1px solid var(--WDS-lines-divider)",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Icon.SearchEmoji
                      width={18}
                      height={18}
                      style={{
                        color: "var(--WDS-neutral-gray-500)",
                        flexShrink: 0,
                      }}
                    />
                    <input
                      type="text"
                      placeholder={t("searchEmoji")}
                      value={emojiSearch}
                      onChange={(e) => setEmojiSearch(e.target.value)}
                      style={{
                        flex: 1,
                        border: "none",
                        background: "transparent",
                        outline: "none",
                        fontSize: 13,
                        color: "var(--WDS-content-default)",
                        fontFamily: "inherit",
                      }}
                    />
                    {emojiSearch && (
                      <button
                        onClick={() => setEmojiSearch("")}
                        style={{
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          color: "var(--WDS-neutral-gray-500)",
                          display: "flex",
                        }}
                      >
                        <Icon.X width={14} height={14} />
                      </button>
                    )}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 2,
                      padding: "6px 8px",
                      borderBottom: "1px solid var(--WDS-lines-divider)",
                      overflowX: "auto",
                      flexShrink: 0,
                      scrollbarWidth: "none",
                    }}
                  >
                    {EMOJI_CATEGORIES.map((cat) => {
                      const IconCat = Icon[
                        cat.icon as keyof typeof Icon
                      ] as any;
                      const isActive = emojiCategory === cat.id && !emojiSearch;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            setEmojiCategory(cat.id);
                            setEmojiSearch("");
                          }}
                          title={cat.nameKey}
                          style={{
                            width: 36,
                            height: 36,
                            flexShrink: 0,
                            border: "none",
                            borderRadius: 8,
                            background: isActive
                              ? "var(--dashboard-blue)"
                              : "transparent",
                            color: isActive
                              ? "white"
                              : "var(--WDS-neutral-gray-500)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "all 0.15s",
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive)
                              e.currentTarget.style.background =
                                "var(--WDS-warm-gray-300-alpha-15)";
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive)
                              e.currentTarget.style.background = "transparent";
                          }}
                        >
                          <IconCat width={18} height={18} />
                        </button>
                      );
                    })}
                  </div>
                  {!emojiSearch && (
                    <div
                      style={{
                        padding: "6px 12px",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--dashboard-blue)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        borderBottom: "1px solid var(--WDS-lines-divider)",
                        background: "var(--WDS-background-wash-inset)",
                      }}
                    >
                      {
                        EMOJI_CATEGORIES.find((c) => c.id === emojiCategory)
                          ?.nameKey
                      }
                    </div>
                  )}
                  <div
                    style={{
                      flex: 1,
                      overflowY: "auto",
                      padding: 8,
                      display: "grid",
                      gridTemplateColumns: "repeat(8, 1fr)",
                      gap: 2,
                      alignContent: "start",
                    }}
                  >
                    {filteredEmojis.length === 0 ? (
                      <div
                        style={{
                          gridColumn: "1 / -1",
                          textAlign: "center",
                          padding: 24,
                          color: "var(--WDS-content-deemphasized)",
                          fontSize: 13,
                        }}
                      >
                        <Icon.SearchEmoji
                          width={32}
                          height={32}
                          style={{ opacity: 0.3, marginBottom: 8 }}
                        />
                        <p>{t("noEmojiFound")}</p>
                      </div>
                    ) : (
                      filteredEmojis.map((emoji, idx) => (
                        <button
                          key={`${emoji}-${idx}`}
                          type="button"
                          onClick={() => {
                            setDraft((value) => value + emoji);
                            inputRef.current?.focus();
                          }}
                          title={emoji}
                          style={{
                            border: "none",
                            background: "transparent",
                            fontSize: 22,
                            cursor: "pointer",
                            borderRadius: 6,
                            padding: 6,
                            lineHeight: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "background 0.1s",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background =
                              "var(--WDS-warm-gray-300-alpha-15)")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background = "transparent")
                          }
                        >
                          {emoji}
                        </button>
                      ))
                    )}
                  </div>
                  <div
                    style={{
                      padding: "6px 12px",
                      borderTop: "1px solid var(--WDS-lines-divider)",
                      fontSize: 11,
                      color: "var(--WDS-content-deemphasized)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      background: "var(--WDS-background-wash-inset)",
                    }}
                  >
                    <span>
                      {filteredEmojis.length} {t("emojis")}
                    </span>
                    <span
                      style={{ display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <Icon.Smile width={12} height={12} />
                      {t("clickToInsert")}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {contactPanelOpen && activeChat && (
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: "min(400px, 100%)",
              height: "100%",
              background: "var(--WDS-surface-default)",
              borderLeft: "2px solid var(--dashboard-blue-dark)",
              zIndex: 30,
              display: "flex",
              flexDirection: "column",
              boxShadow: "-4px 0 24px rgba(0,0,0,0.1)",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "2px solid var(--dashboard-blue-dark)",
                background: "var(--dashboard-blue)",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <button
                onClick={() => setContactPanelOpen(false)}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  padding: 4,
                }}
              >
                <Icon.X width={20} height={20} />
              </button>
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "white",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {t("contactData")}
              </h3>
            </div>

            <div style={{ flex: 1, overflowY: "auto" }}>
              <div
                style={{
                  padding: "32px 20px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  borderBottom: "8px solid var(--WDS-background-wash-inset)",
                }}
              >
                <div
                  className={`av-${activeChat.av}`}
                  style={{
                    width: 200,
                    height: 200,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontSize: 72,
                    fontWeight: 600,
                    marginBottom: 16,
                  }}
                >
                  {initial(activeChat.name)}
                </div>
                <h2
                  style={{
                    fontSize: 28,
                    fontWeight: 600,
                    color: "var(--dashboard-blue)",
                    marginBottom: 4,
                  }}
                >
                  {activeChat.name}
                </h2>
                <p
                  style={{
                    fontSize: 14,
                    color: "var(--WDS-content-deemphasized)",
                  }}
                >
                  {activeChat.phone ||
                    (activeChat.type === "group"
                      ? t("privateGroup")
                      : t("privateContact"))}
                </p>
                {activeChat.description && (
                  <p
                    style={{
                      fontSize: 13,
                      color: "var(--WDS-content-deemphasized)",
                      marginTop: 8,
                      fontStyle: "italic",
                    }}
                  >
                    {activeChat.description}
                  </p>
                )}
                {activeChat.muted && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: "4px 12px",
                      background: "var(--dashboard-orange)",
                      color: "white",
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Icon.BellOff width={12} height={12} />
                    {t("muted")}
                  </div>
                )}
                {activeChat.blocked && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: "4px 12px",
                      background: "var(--dashboard-red)",
                      color: "white",
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Icon.UserX width={12} height={12} />
                    {t("blocked")}
                  </div>
                )}
              </div>

              <div
                style={{
                  padding: "16px 20px",
                  borderBottom: "8px solid var(--WDS-background-wash-inset)",
                }}
              >
                <h4
                  style={{
                    fontSize: 14,
                    color: "var(--dashboard-blue)",
                    marginBottom: 12,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {t("info")}
                </h4>
                {activeChat.phone && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      padding: "8px 0",
                    }}
                  >
                    <Icon.Phone
                      width={20}
                      height={20}
                      style={{ color: "var(--dashboard-green)" }}
                    />
                    <div>
                      <div
                        style={{
                          fontSize: 17,
                          color: "var(--WDS-content-default)",
                          fontWeight: 600,
                        }}
                      >
                        {activeChat.phone}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: "var(--WDS-content-deemphasized)",
                        }}
                      >
                        {t("mobile")}
                      </div>
                    </div>
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    padding: "8px 0",
                  }}
                >
                  <Icon.Users
                    width={20}
                    height={20}
                    style={{ color: "var(--dashboard-blue-chart)" }}
                  />
                  <div>
                    <div
                      style={{
                        fontSize: 17,
                        color: "var(--WDS-content-default)",
                        fontWeight: 600,
                      }}
                    >
                      {activeChat.type === "group"
                        ? t("group")
                        : t("individual")}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "var(--WDS-content-deemphasized)",
                      }}
                    >
                      {t("chatType")}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    padding: "8px 0",
                  }}
                >
                  <Icon.Clock
                    width={20}
                    height={20}
                    style={{ color: "var(--dashboard-orange)" }}
                  />
                  <div>
                    <div
                      style={{
                        fontSize: 17,
                        color: "var(--WDS-content-default)",
                        fontWeight: 600,
                      }}
                    >
                      {activeChat.time}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "var(--WDS-content-deemphasized)",
                      }}
                    >
                      {t("lastActivity")}
                    </div>
                  </div>
                </div>
              </div>

              <div
                style={{
                  padding: "16px 20px",
                  borderBottom: "8px solid var(--WDS-background-wash-inset)",
                }}
              >
                <h4
                  style={{
                    fontSize: 14,
                    color: "var(--dashboard-blue)",
                    marginBottom: 12,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {t("mediaLinksDocs")}
                </h4>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 0",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <Icon.Image
                      width={20}
                      height={20}
                      style={{ color: "var(--dashboard-green)" }}
                    />
                    <span
                      style={{
                        fontSize: 16,
                        color: "var(--WDS-content-default)",
                        fontWeight: 600,
                      }}
                    >
                      {t("media")}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 14,
                      color: "var(--WDS-content-deemphasized)",
                    }}
                  >
                    {
                      (messages[activeId || ""] || []).filter(
                        (m) => m.attachment?.type === "image",
                      ).length
                    }
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 0",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <Icon.File
                      width={20}
                      height={20}
                      style={{ color: "var(--dashboard-orange)" }}
                    />
                    <span
                      style={{
                        fontSize: 16,
                        color: "var(--WDS-content-default)",
                        fontWeight: 600,
                      }}
                    >
                      {t("documents")}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 14,
                      color: "var(--WDS-content-deemphasized)",
                    }}
                  >
                    {
                      (messages[activeId || ""] || []).filter(
                        (m) =>
                          m.attachment &&
                          m.attachment.type !== "image" &&
                          m.attachment.type !== "audio",
                      ).length
                    }
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 0",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <Icon.Link
                      width={20}
                      height={20}
                      style={{ color: "var(--dashboard-blue-chart)" }}
                    />
                    <span
                      style={{
                        fontSize: 16,
                        color: "var(--WDS-content-default)",
                        fontWeight: 600,
                      }}
                    >
                      {t("links")}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 14,
                      color: "var(--WDS-content-deemphasized)",
                    }}
                  >
                    {
                      (messages[activeId || ""] || []).filter((m) =>
                        m.text.match(/https?:\/\/\S+/),
                      ).length
                    }
                  </span>
                </div>
              </div>

              {activeChat.type === "group" && activeChat.participants && (
                <div
                  style={{
                    padding: "16px 20px",
                    borderBottom: "8px solid var(--WDS-background-wash-inset)",
                  }}
                >
                  <h4
                    style={{
                      fontSize: 14,
                      color: "var(--dashboard-blue)",
                      marginBottom: 12,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {activeChat.participants.length + 1} {t("participants")}
                  </h4>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "8px 0",
                    }}
                  >
                    <div
                      className="av-1"
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                        fontWeight: 600,
                      }}
                    >
                      {initial(
                        session?.funcionarioNome || session?.username || "EU",
                      )}
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 16,
                          color: "var(--WDS-content-default)",
                        }}
                      >
                        {session?.funcionarioNome ||
                          session?.username ||
                          t("you")}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: "var(--WDS-content-deemphasized)",
                        }}
                      >
                        {activeChat.creator === session?.username
                          ? t("groupCreator")
                          : t("member")}
                      </div>
                    </div>
                  </div>
                  {activeChat.participants.map((pId) => {
                    const p = chats.find((c) => c.id === pId);
                    if (!p) return null;
                    return (
                      <div
                        key={pId}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "8px 0",
                        }}
                      >
                        <div
                          className={`av-${p.av}`}
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "white",
                            fontWeight: 600,
                          }}
                        >
                          {initial(p.name)}
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: 16,
                              color: "var(--WDS-content-default)",
                            }}
                          >
                            {p.name}
                          </div>
                          <div
                            style={{
                              fontSize: 13,
                              color: "var(--WDS-content-deemphasized)",
                            }}
                          >
                            {p.phone || t("member")}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ padding: "8px 0" }}>
                <button
                  onClick={() => setShowMuteOptions(true)}
                  style={{
                    width: "100%",
                    padding: "14px 20px",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 24,
                    color: "var(--WDS-content-default)",
                    fontSize: 16,
                    textAlign: "left",
                    fontWeight: 600,
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background =
                      "var(--WDS-warm-gray-300-alpha-15)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  {activeChat.muted ? (
                    <Icon.Volume
                      width={20}
                      height={20}
                      style={{ color: "var(--dashboard-orange)" }}
                    />
                  ) : (
                    <Icon.BellOff
                      width={20}
                      height={20}
                      style={{ color: "var(--dashboard-orange)" }}
                    />
                  )}
                  {activeChat.muted
                    ? t("unmuteNotifications")
                    : t("muteNotifications")}
                </button>

                <button
                  onClick={() => {
                    setWallpaperPanelOpen(true);
                    setContactPanelOpen(false);
                  }}
                  style={{
                    width: "100%",
                    padding: "14px 20px",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 24,
                    color: "var(--WDS-content-default)",
                    fontSize: 16,
                    textAlign: "left",
                    fontWeight: 600,
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background =
                      "var(--WDS-warm-gray-300-alpha-15)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <Icon.Palette
                    width={20}
                    height={20}
                    style={{ color: "var(--dashboard-blue-chart)" }}
                  />
                  {t("wallpaper")}
                </button>

                <button
                  onClick={() => handleMenuAction("clear")}
                  style={{
                    width: "100%",
                    padding: "14px 20px",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 24,
                    color: "var(--WDS-content-default)",
                    fontSize: 16,
                    textAlign: "left",
                    fontWeight: 600,
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background =
                      "var(--WDS-warm-gray-300-alpha-15)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <Icon.Trash
                    width={20}
                    height={20}
                    style={{ color: "var(--dashboard-gray)" }}
                  />
                  {t("clearMessages")}
                </button>

                <button
                  onClick={handleBlock}
                  style={{
                    width: "100%",
                    padding: "14px 20px",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 24,
                    color: activeChat.blocked
                      ? "var(--dashboard-green)"
                      : "var(--dashboard-red)",
                    fontSize: 16,
                    textAlign: "left",
                    fontWeight: 600,
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = activeChat.blocked
                      ? "rgba(84, 130, 53, 0.08)"
                      : "rgba(232, 76, 61, 0.08)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  {activeChat.blocked ? (
                    <Icon.UserPlus width={20} height={20} />
                  ) : (
                    <Icon.UserX width={20} height={20} />
                  )}
                  {activeChat.blocked ? t("unblockContact") : t("blockContact")}
                </button>

                <button
                  onClick={() => handleMenuAction("delete")}
                  style={{
                    width: "100%",
                    padding: "14px 20px",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 24,
                    color: "#E84C3D",
                    fontSize: 16,
                    textAlign: "left",
                    fontWeight: 600,
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background =
                      "rgba(232, 76, 61, 0.08)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <Icon.Trash width={20} height={20} />
                  {t("deleteConversation")}
                </button>
              </div>
            </div>
          </div>
        )}

        {wallpaperPanelOpen && (
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: "min(420px, 100%)",
              height: "100%",
              background: "var(--WDS-surface-default)",
              borderLeft: "2px solid var(--dashboard-blue-dark)",
              zIndex: 30,
              display: "flex",
              flexDirection: "column",
              boxShadow: "-4px 0 24px rgba(0,0,0,0.1)",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "2px solid var(--dashboard-blue-dark)",
                background: "var(--dashboard-blue)",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <button
                onClick={() => setWallpaperPanelOpen(false)}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  padding: 4,
                }}
              >
                <Icon.X width={20} height={20} />
              </button>
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "white",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {t("wallpaperTitle")}
              </h3>
            </div>

            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--WDS-lines-divider)",
                background: "#F0F7FF",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 8,
                }}
              >
                <Icon.Info
                  width={18}
                  height={18}
                  style={{ color: "var(--dashboard-blue)", flexShrink: 0 }}
                />
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--dashboard-blue)",
                    margin: 0,
                    lineHeight: 1.4,
                    fontWeight: 600,
                  }}
                >
                  {t("wallpaperInfo")}
                </p>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  color: "var(--WDS-content-deemphasized)",
                }}
              >
                <Icon.Contact width={14} height={14} />
                <span>
                  {t("applyingTo")}:{" "}
                  <strong style={{ color: "var(--dashboard-blue)" }}>
                    {activeChat?.name}
                  </strong>
                </span>
              </div>
            </div>

            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--WDS-lines-divider)" }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: "var(--WDS-content-default)", marginBottom: 10 }}>
                {t("bubbleColor")}
              </h4>
              <div role="group" aria-label={t("bubbleColor")}
                style={{ display: "flex", flexWrap: "wrap", gap: 9, alignItems: "center" }}>
                {BUBBLE_COLOURS.map((colour) => (
                  <button type="button" key={colour.id}
                    title={colour.id === "default" ? t("bubbleDefault") : colour.label}
                    aria-label={colour.id === "default" ? t("bubbleDefault") : colour.label}
                    aria-pressed={(activeChat?.bubbleColor || "default") === colour.id}
                    onClick={() => setPreference({ bubbleColor: colour.id })}
                    style={{
                      width: 34, height: 34, borderRadius: "50%", background: colour.color,
                      color: colour.text, cursor: "pointer", display: "grid", placeItems: "center",
                      border: (activeChat?.bubbleColor || "default") === colour.id
                        ? "3px solid var(--dashboard-blue)" : "2px solid var(--WDS-lines-divider)",
                      outline: (activeChat?.bubbleColor || "default") === colour.id ? "2px solid var(--WDS-surface-default)" : undefined,
                    }}>
                    {(activeChat?.bubbleColor || "default") === colour.id && <Icon.Check width={17} height={17} />}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
                <span style={{ flex: 1, fontSize: 12, color: "var(--WDS-content-deemphasized)" }}>
                  {t("bubbleDefault")}: {BUBBLE_COLOURS.find((colour) => colour.id === defaultBubbleColor)?.label || "Institucional"}
                </span>
                <button type="button"
                  onClick={() => void savePreference("settings", { bubbleColor: currentBubble.id }).catch(report)}
                  style={{ border: "1px solid var(--dashboard-blue)", color: "var(--dashboard-blue)",
                    borderRadius: 12, background: "transparent", padding: "8px 10px", fontSize: 11, fontWeight: 700,
                    maxWidth: 190, cursor: "pointer" }}>
                  {t("bubbleAllChats")}
                </button>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                borderBottom: "2px solid var(--dashboard-blue-dark)",
                padding: "0 20px",
              }}
            >
              {[
                { id: "colors", label: t("colors"), icon: Icon.Palette },
                { id: "patterns", label: t("patterns"), icon: Icon.Image },
                { id: "my", label: t("myPhotos"), icon: Icon.Image },
              ].map((tab) => {
                const TabIcon = tab.icon;
                const isActive = wallpaperTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setWallpaperTab(tab.id as any)}
                    style={{
                      flex: 1,
                      padding: "12px 8px",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      fontSize: 13,
                      fontWeight: isActive ? 700 : 400,
                      color: isActive
                        ? "var(--dashboard-blue)"
                        : "var(--WDS-neutral-gray-500)",
                      borderBottom: isActive
                        ? "3px solid var(--dashboard-blue)"
                        : "3px solid transparent",
                      transition: "all 0.15s",
                    }}
                  >
                    <TabIcon width={16} height={16} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
              {wallpaperTab === "colors" && (
                <div>
                  <h4
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "var(--dashboard-blue)",
                      marginBottom: 12,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {t("solidColors")}
                  </h4>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, 1fr)",
                      gap: 12,
                    }}
                  >
                    {WALLPAPERS.filter((w) => w.type === "solid").map((wp) => {
                      const isActive =
                        wallpapersByChat[activeId || -1] === wp.id;
                      return (
                        <button
                          key={wp.id}
                          type="button"
                          onClick={() => applyWallpaper(wp.id)}
                          title={getWallpaperName(wp.nameKey)}
                          style={{
                            aspectRatio: "1",
                            border: isActive
                              ? "3px solid var(--dashboard-blue)"
                              : "2px solid var(--WDS-lines-divider)",
                            borderRadius: 12,
                            background: wp.value,
                            cursor: "pointer",
                            position: "relative",
                            transition: "all 0.15s",
                            padding: 0,
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive)
                              e.currentTarget.style.transform = "scale(1.05)";
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive)
                              e.currentTarget.style.transform = "scale(1)";
                          }}
                        >
                          {isActive && (
                            <div
                              style={{
                                position: "absolute",
                                top: 4,
                                right: 4,
                                width: 20,
                                height: 20,
                                borderRadius: "50%",
                                background: "var(--dashboard-blue)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Icon.Check
                                width={12}
                                height={12}
                                style={{ color: "white" }}
                              />
                            </div>
                          )}
                          <span
                            style={{
                              position: "absolute",
                              bottom: 4,
                              left: 0,
                              right: 0,
                              fontSize: 10,
                              fontWeight: 700,
                              color: "rgba(255,255,255,0.9)",
                              textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                            }}
                          >
                            {getWallpaperName(wp.nameKey)}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <h4
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "var(--dashboard-blue)",
                      margin: "20px 0 12px",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {t("gradients")}
                  </h4>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, 1fr)",
                      gap: 12,
                    }}
                  >
                    {WALLPAPERS.filter((w) => w.type === "gradient").map(
                      (wp) => {
                        const isActive =
                          wallpapersByChat[activeId || -1] === wp.id;
                        return (
                          <button
                            key={wp.id}
                            type="button"
                            onClick={() => applyWallpaper(wp.id)}
                            title={getWallpaperName(wp.nameKey)}
                            style={{
                              aspectRatio: "1.5",
                              border: isActive
                                ? "3px solid var(--dashboard-blue)"
                                : "2px solid var(--WDS-lines-divider)",
                              borderRadius: 12,
                              background: wp.value,
                              cursor: "pointer",
                              position: "relative",
                              transition: "all 0.15s",
                              padding: 0,
                            }}
                            onMouseEnter={(e) => {
                              if (!isActive)
                                e.currentTarget.style.transform = "scale(1.03)";
                            }}
                            onMouseLeave={(e) => {
                              if (!isActive)
                                e.currentTarget.style.transform = "scale(1)";
                            }}
                          >
                            {isActive && (
                              <div
                                style={{
                                  position: "absolute",
                                  top: 6,
                                  right: 6,
                                  width: 22,
                                  height: 22,
                                  borderRadius: "50%",
                                  background: "var(--dashboard-blue)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <Icon.Check
                                  width={12}
                                  height={12}
                                  style={{ color: "white" }}
                                />
                              </div>
                            )}
                            <span
                              style={{
                                position: "absolute",
                                bottom: 6,
                                left: 0,
                                right: 0,
                                fontSize: 11,
                                fontWeight: 700,
                                color: "rgba(255,255,255,0.95)",
                                textShadow: "0 1px 3px rgba(0,0,0,0.5)",
                              }}
                            >
                              {getWallpaperName(wp.nameKey)}
                            </span>
                          </button>
                        );
                      },
                    )}
                  </div>
                </div>
              )}

              {wallpaperTab === "patterns" && (
                <div>
                  <h4
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "var(--dashboard-blue)",
                      marginBottom: 12,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {t("patterns")}
                  </h4>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, 1fr)",
                      gap: 12,
                    }}
                  >
                    {WALLPAPERS.filter((w) => w.type === "pattern").map(
                      (wp) => {
                        const isActive =
                          wallpapersByChat[activeId || -1] === wp.id;
                        return (
                          <button
                            key={wp.id}
                            type="button"
                            onClick={() => applyWallpaper(wp.id)}
                            title={getWallpaperName(wp.nameKey)}
                            style={{
                              aspectRatio: "1.5",
                              border: isActive
                                ? "3px solid var(--dashboard-blue)"
                                : "2px solid var(--WDS-lines-divider)",
                              borderRadius: 12,
                              background: `var(--WDS-surface-default)`,
                              backgroundImage: wp.value,
                              backgroundSize: wp.size || "cover",
                              cursor: "pointer",
                              position: "relative",
                              transition: "all 0.15s",
                              padding: 0,
                            }}
                            onMouseEnter={(e) => {
                              if (!isActive)
                                e.currentTarget.style.transform = "scale(1.03)";
                            }}
                            onMouseLeave={(e) => {
                              if (!isActive)
                                e.currentTarget.style.transform = "scale(1)";
                            }}
                          >
                            {isActive && (
                              <div
                                style={{
                                  position: "absolute",
                                  top: 6,
                                  right: 6,
                                  width: 22,
                                  height: 22,
                                  borderRadius: "50%",
                                  background: "var(--dashboard-blue)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <Icon.Check
                                  width={12}
                                  height={12}
                                  style={{ color: "white" }}
                                />
                              </div>
                            )}
                            <span
                              style={{
                                position: "absolute",
                                bottom: 6,
                                left: 0,
                                right: 0,
                                fontSize: 11,
                                fontWeight: 700,
                                color: "var(--WDS-content-default)",
                                background: "rgba(255,255,255,0.8)",
                                padding: "2px 6px",
                                borderRadius: 4,
                                margin: "0 8px 6px",
                              }}
                            >
                              {getWallpaperName(wp.nameKey)}
                            </span>
                          </button>
                        );
                      },
                    )}
                  </div>

                  <div
                    style={{
                      marginTop: 20,
                      padding: 12,
                      background: "#F0F7FF",
                      borderRadius: 8,
                      border: "2px solid var(--dashboard-blue)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <Icon.Info
                        width={14}
                        height={14}
                        style={{ color: "var(--dashboard-blue)" }}
                      />
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "var(--dashboard-blue)",
                        }}
                      >
                        {t("tip")}
                      </span>
                    </div>
                    <p
                      style={{
                        fontSize: 12,
                        color: "var(--WDS-content-deemphasized)",
                        margin: 0,
                        lineHeight: 1.4,
                      }}
                    >
                      {t("tipText")}
                    </p>
                  </div>
                </div>
              )}

              {wallpaperTab === "my" && (
                <div style={{ textAlign: "center", padding: "40px 20px" }}>
                  <Icon.Image
                    width={64}
                    height={64}
                    style={{
                      opacity: 0.3,
                      marginBottom: 16,
                      color: "var(--dashboard-gray)",
                    }}
                  />
                  <h4
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: "var(--dashboard-blue)",
                      marginBottom: 8,
                    }}
                  >
                    {t("myPhotosTitle")}
                  </h4>
                  <p
                    style={{
                      fontSize: 13,
                      color: "var(--WDS-content-deemphasized)",
                      marginBottom: 20,
                      lineHeight: 1.5,
                    }}
                  >
                    {t("myPhotosDesc")}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = "image/*";
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            if (activeId !== null) {
                              if (
                                file.size > 500000 ||
                                !["image/png", "image/jpeg"].includes(file.type)
                              ) {
                                report(
                                  new Error(
                                    "Papel de parede: PNG/JPEG até 500 KB.",
                                  ),
                                );
                                return;
                              }
                              applyWallpaper(String(ev.target?.result));
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      };
                      input.click();
                    }}
                    style={{
                      padding: "10px 20px",
                      background: "var(--dashboard-blue)",
                      color: "white",
                      border: "2px solid var(--dashboard-blue-dark)",
                      borderRadius: 20,
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Icon.Upload width={16} height={16} />
                    {t("chooseImage")}
                  </button>
                </div>
              )}
            </div>

            <div
              style={{
                padding: "12px 20px",
                borderTop: "2px solid var(--dashboard-blue-dark)",
                background: "var(--WDS-background-wash-inset)",
                display: "flex",
                gap: 8,
              }}
            >
              <button
                type="button"
                onClick={resetWallpaper}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  background: "transparent",
                  color: "var(--dashboard-blue)",
                  border: "2px solid var(--dashboard-blue)",
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <Icon.Archive width={14} height={14} />
                {t("restoreDefault")}
              </button>
              <button
                type="button"
                onClick={() => setWallpaperPanelOpen(false)}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  background: "var(--dashboard-blue)",
                  color: "white",
                  border: "2px solid var(--dashboard-blue-dark)",
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <Icon.Check width={14} height={14} />
                {t("done")}
              </button>
            </div>
          </div>
        )}
      </div>

      {contextMenu && (
        <div
          className="context-menu"
          style={{
            position: "fixed",
            top: contextMenu.y,
            left: contextMenu.x,
            minWidth: 200,
            background: "var(--WDS-surface-default)",
            border: "2px solid var(--dashboard-blue)",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
            zIndex: 100,
            padding: "4px 0",
          }}
        >
          <button
            type="button"
            onClick={() => {
              const msg = currentMessages.find(
                (m) => m.id === contextMenu.messageId,
              );
              if (msg) handleCopyMessage(msg);
            }}
            style={{
              width: "100%",
              padding: "10px 16px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 12,
              color: "var(--WDS-content-default)",
              fontSize: 14,
              textAlign: "left",
              fontWeight: 600,
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background =
                "var(--WDS-warm-gray-300-alpha-15)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            <Icon.Copy width={16} height={16} />
            {t("copy")}
          </button>
          <button
            type="button"
            onClick={() => {
              const msg = currentMessages.find(
                (m) => m.id === contextMenu.messageId,
              );
              if (msg) handleReply(msg);
            }}
            style={{
              width: "100%",
              padding: "10px 16px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 12,
              color: "var(--WDS-content-default)",
              fontSize: 14,
              textAlign: "left",
              fontWeight: 600,
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background =
                "var(--WDS-warm-gray-300-alpha-15)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            <Icon.Reply width={16} height={16} />
            {t("reply")}
          </button>
          <button
            type="button"
            onClick={() => {
              const msg = currentMessages.find(
                (m) => m.id === contextMenu.messageId,
              );
              if (msg) handleForward(msg);
            }}
            style={{
              width: "100%",
              padding: "10px 16px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 12,
              color: "var(--WDS-content-default)",
              fontSize: 14,
              textAlign: "left",
              fontWeight: 600,
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background =
                "var(--WDS-warm-gray-300-alpha-15)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            <Icon.Forward width={16} height={16} />
            {t("forward")}
          </button>
          {currentMessages.find((m) => m.id === contextMenu.messageId)?.type ===
            "sent" && (
            <>
              <button
                type="button"
                onClick={() => {
                  const msg = currentMessages.find(
                    (m) => m.id === contextMenu.messageId,
                  );
                  if (msg) handleEdit(msg);
                }}
                style={{
                  width: "100%",
                  padding: "10px 16px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  color: "var(--WDS-content-default)",
                  fontSize: 14,
                  textAlign: "left",
                  fontWeight: 600,
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background =
                    "var(--WDS-warm-gray-300-alpha-15)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <Icon.Edit width={16} height={16} />
                {t("edit")}
              </button>
              <button
                type="button"
                onClick={() => handleDeleteMessage(contextMenu.messageId)}
                style={{
                  width: "100%",
                  padding: "10px 16px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  color: "#E84C3D",
                  fontSize: 14,
                  textAlign: "left",
                  fontWeight: 600,
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(232, 76, 61, 0.08)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <Icon.Trash width={16} height={16} />
                {t("delete")}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() =>
              setReactionPicker({
                x: contextMenu.x,
                y: contextMenu.y,
                messageId: contextMenu.messageId,
              })
            }
            style={{
              width: "100%",
              padding: "10px 16px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 12,
              color: "var(--WDS-content-default)",
              fontSize: 14,
              textAlign: "left",
              fontWeight: 600,
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background =
                "var(--WDS-warm-gray-300-alpha-15)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            <Icon.Smile width={16} height={16} />
            {t("react")}
          </button>
        </div>
      )}

      {reactionPicker && (
        <div
          className="reaction-picker"
          style={{
            position: "fixed",
            top: reactionPicker.y - 60,
            left: reactionPicker.x,
            background: "var(--WDS-surface-default)",
            border: "2px solid var(--dashboard-blue)",
            borderRadius: 24,
            boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
            zIndex: 101,
            padding: "8px 12px",
            display: "flex",
            gap: 8,
          }}
        >
          {["👍", "❤️", "😂", "😮", "😢", ""].map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleReaction(reactionPicker.messageId, emoji)}
              style={{
                border: "none",
                background: "transparent",
                fontSize: 24,
                cursor: "pointer",
                padding: 4,
                borderRadius: 8,
                transition: "transform 0.1s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.transform = "scale(1.3)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.transform = "scale(1)")
              }
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {showMuteOptions && (
        <div
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "var(--WDS-surface-default)",
            border: "2px solid var(--dashboard-blue)",
            borderRadius: 12,
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            zIndex: 102,
            padding: 24,
            minWidth: 300,
          }}
        >
          <h3
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "var(--dashboard-blue)",
              marginBottom: 16,
              textAlign: "center",
            }}
          >
            {t("muteTitle")}
          </h3>
          <p
            style={{
              fontSize: 13,
              color: "var(--WDS-content-deemphasized)",
              marginBottom: 20,
              textAlign: "center",
            }}
          >
            {t("muteDesc")} "{activeChat?.name}"
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { label: t("hours8"), duration: 8 * 3600000 },
              { label: t("week1"), duration: 7 * 24 * 3600000 },
              { label: t("year1"), duration: 365 * 24 * 3600000 },
              { label: t("forever"), duration: null },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => handleMute(option.duration)}
                style={{
                  padding: "12px 16px",
                  border: "2px solid var(--WDS-lines-divider)",
                  borderRadius: 8,
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--WDS-content-default)",
                  textAlign: "left",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    "var(--WDS-warm-gray-300-alpha-15)";
                  e.currentTarget.style.borderColor = "var(--dashboard-blue)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.borderColor =
                    "var(--WDS-lines-divider)";
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowMuteOptions(false)}
            style={{
              width: "100%",
              marginTop: 16,
              padding: "10px 16px",
              border: "2px solid var(--dashboard-gray)",
              borderRadius: 8,
              background: "transparent",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
              color: "var(--WDS-content-default)",
            }}
          >
            {t("cancel")}
          </button>
        </div>
      )}

      {mediaGallery && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            zIndex: 103,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setMediaGallery(false)}
        >
          <div
            style={{
              background: "var(--WDS-surface-default)",
              borderRadius: 12,
              padding: 32,
              maxWidth: 600,
              width: "90%",
              maxHeight: "80vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <h3
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: "var(--dashboard-blue)",
                }}
              >
                {t("mediaGallery")}
              </h3>
              <button
                onClick={() => setMediaGallery(false)}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                }}
              >
                <Icon.X width={24} height={24} />
              </button>
            </div>
            {(() => {
              const mediaMessages = (messages[activeId || -1] || []).filter(
                (m) => m.attachment,
              );
              if (mediaMessages.length === 0) {
                return (
                  <div style={{ textAlign: "center", padding: 40 }}>
                    <Icon.Image
                      width={64}
                      height={64}
                      style={{
                        color: "var(--dashboard-gray)",
                        opacity: 0.3,
                        marginBottom: 16,
                      }}
                    />
                    <p style={{ color: "var(--WDS-content-deemphasized)" }}>
                      {t("noMediaShared")}
                    </p>
                  </div>
                );
              }
              return (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 8,
                  }}
                >
                  {mediaMessages
                    .map((m) => m.attachment)
                    .filter(Boolean)
                    .map((att, i) => (
                      <div
                        key={i}
                        style={{
                          aspectRatio: "1",
                          borderRadius: 8,
                          overflow: "hidden",
                          cursor: "pointer",
                          background: "#f0f0f0",
                        }}
                      >
                        {att!.type === "image" ? (
                          <img
                            src={att!.url}
                            alt={att!.name}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                            onClick={() => window.open(att!.url, "_blank")}
                          />
                        ) : (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              height: "100%",
                              padding: 8,
                            }}
                          >
                            <Icon.File
                              width={32}
                              height={32}
                              style={{ color: "var(--dashboard-blue)" }}
                            />
                            <div
                              style={{
                                fontSize: 10,
                                textAlign: "center",
                                marginTop: 4,
                              }}
                            >
                              {att!.name}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {statsOpen && chatStats && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            zIndex: 103,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setStatsOpen(false)}
        >
          <div
            style={{
              background: "var(--WDS-surface-default)",
              borderRadius: 12,
              padding: 32,
              maxWidth: 700,
              width: "90%",
              maxHeight: "80vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <h3
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: "var(--dashboard-blue)",
                }}
              >
                {t("statisticsTitle")}
              </h3>
              <button
                onClick={() => setStatsOpen(false)}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                }}
              >
                <Icon.X width={24} height={24} />
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 12,
                marginBottom: 24,
              }}
            >
              <div
                style={{
                  padding: 16,
                  background: "var(--dashboard-blue)",
                  color: "white",
                  borderRadius: 8,
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 28, fontWeight: 700 }}>
                  {chatStats.total}
                </div>
                <div style={{ fontSize: 11, opacity: 0.9 }}>{t("total")}</div>
              </div>
              <div
                style={{
                  padding: 16,
                  background: "var(--dashboard-green)",
                  color: "white",
                  borderRadius: 8,
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 28, fontWeight: 700 }}>
                  {chatStats.sent}
                </div>
                <div style={{ fontSize: 11, opacity: 0.9 }}>{t("sent")}</div>
              </div>
              <div
                style={{
                  padding: 16,
                  background: "var(--dashboard-orange)",
                  color: "white",
                  borderRadius: 8,
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 28, fontWeight: 700 }}>
                  {chatStats.received}
                </div>
                <div style={{ fontSize: 11, opacity: 0.9 }}>
                  {t("received")}
                </div>
              </div>
              <div
                style={{
                  padding: 16,
                  background: "#764ba2",
                  color: "white",
                  borderRadius: 8,
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 28, fontWeight: 700 }}>
                  {chatStats.ai}
                </div>
                <div style={{ fontSize: 11, opacity: 0.9 }}>{t("ai")}</div>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
                marginBottom: 24,
              }}
            >
              <div>
                <h4
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "var(--dashboard-blue)",
                    marginBottom: 12,
                  }}
                >
                  {t("distribution")}
                </h4>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={chatStats.distribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label
                    >
                      {chatStats.distribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div>
                <h4
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "var(--dashboard-blue)",
                    marginBottom: 12,
                  }}
                >
                  {t("messagesPerDay")}
                </h4>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chatStats.byDay}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#1F4E79" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <h4
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--dashboard-blue)",
                  marginBottom: 12,
                }}
              >
                {t("topEmojis")}
              </h4>
              {chatStats.topEmojis.length === 0 ? (
                <p
                  style={{
                    color: "var(--WDS-content-deemphasized)",
                    fontSize: 13,
                  }}
                >
                  {t("noEmojisUsed")}
                </p>
              ) : (
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {chatStats.topEmojis.map((e, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "8px 16px",
                        background: "#F0F7FF",
                        borderRadius: 20,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span style={{ fontSize: 24 }}>{e.emoji}</span>
                      <span
                        style={{
                          fontWeight: 600,
                          color: "var(--dashboard-blue)",
                        }}
                      >
                        {e.count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div
              style={{
                marginTop: 20,
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <div
                style={{ padding: 12, background: "#F0F7FF", borderRadius: 8 }}
              >
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--WDS-content-deemphasized)",
                  }}
                >
                  {t("withAttachments")}
                </div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: "var(--dashboard-blue)",
                  }}
                >
                  {chatStats.withAttachments}
                </div>
              </div>
              <div
                style={{ padding: 12, background: "#F0F7FF", borderRadius: 8 }}
              >
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--WDS-content-deemphasized)",
                  }}
                >
                  {t("withAudio")}
                </div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: "var(--dashboard-blue)",
                  }}
                >
                  {chatStats.withAudio}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {forwardingMessage && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            zIndex: 103,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setForwardingMessage(null)}
        >
          <div
            style={{
              background: "var(--WDS-surface-default)",
              borderRadius: 12,
              padding: 32,
              maxWidth: 500,
              width: "90%",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "var(--dashboard-blue)",
                marginBottom: 16,
              }}
            >
              {t("forwardTitle")}
            </h3>
            <div
              style={{
                padding: 12,
                background: "#F0F7FF",
                borderRadius: 8,
                marginBottom: 16,
                borderLeft: "3px solid var(--dashboard-blue)",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "var(--dashboard-blue)",
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                {t("messageToForward")}:
              </div>
              <div
                style={{ fontSize: 14, color: "var(--WDS-content-default)" }}
              >
                {forwardingMessage.text}
              </div>
            </div>
            <p
              style={{
                fontSize: 13,
                color: "var(--WDS-content-deemphasized)",
                marginBottom: 24,
              }}
            >
              {t("selectConversation")}
            </p>
            <select
              aria-label="Conversa de destino"
              value={forwardTarget}
              onChange={(e) => setForwardTarget(e.target.value)}
              style={{ width: "100%", padding: 10, marginBottom: 12 }}
            >
              <option value="">Seleccionar conversa</option>
              {chats
                .filter((c) => !c.blocked)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
            <div
              style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
            >
              <button
                type="button"
                onClick={() => setForwardingMessage(null)}
                style={{
                  padding: "10px 20px",
                  border: "2px solid var(--dashboard-gray)",
                  borderRadius: 20,
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--WDS-content-default)",
                }}
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!forwardTarget || !forwardingMessage || busySend.current)
                    return;
                  busySend.current = true;
                  void (async () => {
                    let file:
                      | { name: string; url: string; size: number }
                      | undefined;
                    if (forwardingMessage.attachment) {
                      const a = forwardingMessage.attachment,
                        blob = await fetch(a.url).then((r) => r.blob());
                      const url = await new Promise<string>(
                        (resolve, reject) => {
                          const reader = new FileReader();
                          reader.onload = () => resolve(String(reader.result));
                          reader.onerror = () =>
                            reject(new Error("Falha ao ler anexo."));
                          reader.readAsDataURL(blob);
                        },
                      );
                      file = { name: a.name, url, size: blob.size };
                    }
                    await submitMessage(
                      forwardTarget,
                      forwardingMessage.text,
                      file,
                    );
                    setForwardingMessage(null);
                    setForwardTarget("");
                    notify(t("forwardSuccess"));
                    await refresh();
                  })()
                    .catch(report)
                    .finally(() => {
                      busySend.current = false;
                    });
                }}
                style={{
                  padding: "10px 20px",
                  background: "var(--dashboard-blue)",
                  color: "white",
                  border: "2px solid var(--dashboard-blue-dark)",
                  borderRadius: 20,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {t("forward")}
              </button>
            </div>
          </div>
        </div>
      )}

      {createGroupOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            zIndex: 103,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setCreateGroupOpen(false)}
        >
          <div
            style={{
              background: "var(--WDS-surface-default)",
              borderRadius: 12,
              padding: 32,
              maxWidth: 500,
              width: "90%",
              maxHeight: "80vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "var(--dashboard-blue)",
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Icon.Users width={24} height={24} />
              {t("createGroup")}
            </h3>

            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--dashboard-blue)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                {t("groupName")}
              </label>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder={t("groupName")}
                style={{
                  width: "100%",
                  padding: 10,
                  border: "2px solid var(--dashboard-blue)",
                  borderRadius: 8,
                  fontSize: 14,
                  outline: "none",
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--dashboard-blue)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                {t("participantsLabel")} ({selectedParticipants.length}{" "}
                {t("selected")})
              </label>
              <div
                style={{
                  maxHeight: 300,
                  overflowY: "auto",
                  border: "2px solid #E0E0E0",
                  borderRadius: 8,
                }}
              >
                {chats
                  .filter((c) => c.type === "individual")
                  .map((chat) => {
                    const isSelected = selectedParticipants.includes(chat.id);
                    return (
                      <div
                        key={chat.id}
                        onClick={() => {
                          setSelectedParticipants((prev) =>
                            isSelected
                              ? prev.filter((id) => id !== chat.id)
                              : [...prev, chat.id],
                          );
                        }}
                        style={{
                          padding: "10px 12px",
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          cursor: "pointer",
                          background: isSelected ? "#E8F0FE" : "transparent",
                          borderBottom: "1px solid #E8E8E8",
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected)
                            e.currentTarget.style.background = "#F5F5F5";
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected)
                            e.currentTarget.style.background = "transparent";
                        }}
                      >
                        <div
                          className={`av-${chat.av}`}
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "white",
                            fontWeight: 600,
                            fontSize: 16,
                          }}
                        >
                          {initial(chat.name)}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>
                            {chat.name}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: "var(--WDS-content-deemphasized)",
                            }}
                          >
                            {chat.phone}
                          </div>
                        </div>
                        {isSelected && (
                          <Icon.Check
                            width={20}
                            height={20}
                            style={{ color: "var(--dashboard-blue)" }}
                          />
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            <div
              style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
            >
              <button
                type="button"
                onClick={() => setCreateGroupOpen(false)}
                style={{
                  padding: "10px 20px",
                  border: "2px solid var(--dashboard-gray)",
                  borderRadius: 20,
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--WDS-content-default)",
                }}
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={createGroup}
                disabled={
                  !newGroupName.trim() || selectedParticipants.length === 0
                }
                style={{
                  padding: "10px 20px",
                  background: "var(--dashboard-blue)",
                  color: "white",
                  border: "2px solid var(--dashboard-blue-dark)",
                  borderRadius: 20,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  opacity:
                    !newGroupName.trim() || selectedParticipants.length === 0
                      ? 0.5
                      : 1,
                }}
              >
                <Icon.Check
                  width={14}
                  height={14}
                  style={{ display: "inline", marginRight: 6 }}
                />
                {t("create")}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`toast${toast ? " show" : ""}`} role="status">
        {toast}
      </div>

      {newChatOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("newChatLocal")}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 20,
            background: "#0008",
            display: "grid",
            placeItems: "center",
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setNewChatOpen(false);
          }}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              createChat();
            }}
            style={{
              padding: 24,
              borderRadius: 12,
              background: "var(--WDS-surface-default)",
              width: "min(90%,360px)",
              border: "2px solid var(--dashboard-blue)",
            }}
          >
            <h2
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "var(--dashboard-blue)",
                fontWeight: 700,
              }}
            >
              <Icon.Plus width={20} height={20} />
              {t("newChatLocal")}
            </h2>
            <label
              htmlFor="chat-contact-name"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginTop: 12,
                fontWeight: 600,
              }}
            >
              <Icon.Contact width={14} height={14} />
              {t("contactName")}
            </label>
            <datalist id="chat-company-contacts">
              {chats
                .filter((c) => c.type === "individual")
                .map((c) => (
                  <option key={c.id} value={c.phone}>
                    {c.name}
                  </option>
                ))}
            </datalist>
            <input
              list="chat-company-contacts"
              id="chat-contact-name"
              autoFocus
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              required
              style={{
                width: "100%",
                padding: 10,
                margin: "12px 0",
                border: "2px solid var(--dashboard-blue)",
                borderRadius: 8,
                color: "inherit",
                background: "transparent",
              }}
              placeholder={t("contactNamePlaceholder")}
            />
            <p
              style={{
                fontSize: 12,
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Icon.Info width={12} height={12} />
              {t("sessionOnly")}
            </p>
            <div
              style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
            >
              <button
                type="button"
                onClick={() => setNewChatOpen(false)}
                style={{
                  padding: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  border: "2px solid var(--dashboard-gray)",
                  borderRadius: 6,
                  background: "transparent",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                <Icon.X width={14} height={14} />
                {t("cancel")}
              </button>
              <button
                type="submit"
                disabled={!newName.trim()}
                style={{
                  padding: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  border: "2px solid var(--dashboard-green)",
                  borderRadius: 6,
                  background: "var(--dashboard-green)",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                <Icon.Check width={14} height={14} />
                {t("create")}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// Remount on identity changes so no previous tenant's state is reused.
export default function ChatApp(props: ChatAppProps = {}) {
  return (
    <ChatView
      key={`${props.session?.empresaId || ""}:${props.session?.username || ""}:${props.session?.funcionarioId || ""}`}
      {...props}
    />
  );
}
