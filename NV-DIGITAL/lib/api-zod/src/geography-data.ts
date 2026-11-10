// Extracted from official Lei 14/24, Annex I–XXI. IDs below are stable application IDs, not official administrative codes.
export interface GeoCommune {
  id: string;
  name: string;
}
export interface GeoMunicipality {
  id: string;
  name: string;
  communes: GeoCommune[];
}
export interface GeoProvince {
  id: string;
  name: string;
  municipalities: GeoMunicipality[];
}
export const GEOGRAPHY_VERSION = "AO-DPA-14-24-20261028";
export const ANGOLA_GEOGRAPHY: GeoProvince[] = [
  {
    id: "AO-8509ab66",
    name: "Cabinda",
    municipalities: [
      { id: "AO-8509ab66-8509ab66", name: "Cabinda", communes: [] },
      {
        id: "AO-8509ab66-2ea68ede",
        name: "Cacongo",
        communes: [
          { id: "AO-8509ab66-2ea68ede-ae6d13f2", name: "Lândana" },
          { id: "AO-8509ab66-2ea68ede-f2c54c55", name: "Dinge" },
        ],
      },
      { id: "AO-8509ab66-78c0d05e", name: "Buco Zau", communes: [] },
      {
        id: "AO-8509ab66-42ab0c94",
        name: "Belize",
        communes: [
          { id: "AO-8509ab66-42ab0c94-42ab0c94", name: "Belize" },
          { id: "AO-8509ab66-42ab0c94-abd75e91", name: "Luali" },
        ],
      },
      { id: "AO-8509ab66-5bb89d02", name: "Miconje", communes: [] },
      { id: "AO-8509ab66-a1f90356", name: "Massabi", communes: [] },
      {
        id: "AO-8509ab66-77118edc",
        name: "Necuto",
        communes: [
          { id: "AO-8509ab66-77118edc-77118edc", name: "Necuto" },
          { id: "AO-8509ab66-77118edc-4f09ec61", name: "Inhuca" },
        ],
      },
      {
        id: "AO-8509ab66-503cd209",
        name: "Tando Zinze",
        communes: [
          { id: "AO-8509ab66-503cd209-503cd209", name: "Tando Zinze" },
          { id: "AO-8509ab66-503cd209-3c6c613f", name: "Malembo" },
        ],
      },
      { id: "AO-8509ab66-db632472", name: "Liambo", communes: [] },
      { id: "AO-8509ab66-90b20f6b", name: "Ngoio", communes: [] },
    ],
  },
  {
    id: "AO-cb9ee341",
    name: "Zaire",
    municipalities: [
      {
        id: "AO-cb9ee341-aa1ee3e7",
        name: "Soyo",
        communes: [
          { id: "AO-cb9ee341-aa1ee3e7-aa1ee3e7", name: "Soyo" },
          { id: "AO-cb9ee341-aa1ee3e7-5c0fadc6", name: "Pedra de Feitiço" },
        ],
      },
      {
        id: "AO-cb9ee341-dd8375fd",
        name: "Mbanza Kongo",
        communes: [
          { id: "AO-cb9ee341-dd8375fd-dd8375fd", name: "Mbanza Kongo" },
          { id: "AO-cb9ee341-dd8375fd-138289a8", name: "Madimba" },
          { id: "AO-cb9ee341-dd8375fd-df37a2e8", name: "Caluca" },
          { id: "AO-cb9ee341-dd8375fd-d45cd3bf", name: "Quiende" },
        ],
      },
      {
        id: "AO-cb9ee341-a57187b5",
        name: "Nzeto",
        communes: [
          { id: "AO-cb9ee341-a57187b5-a57187b5", name: "Nzeto" },
          { id: "AO-cb9ee341-a57187b5-17200f1e", name: "Musserra" },
        ],
      },
      {
        id: "AO-cb9ee341-0218b25b",
        name: "Tomboco",
        communes: [
          { id: "AO-cb9ee341-0218b25b-0218b25b", name: "Tomboco" },
          { id: "AO-cb9ee341-0218b25b-15e54053", name: "Quinsimba" },
          { id: "AO-cb9ee341-0218b25b-36e763d4", name: "Quinzau" },
        ],
      },
      {
        id: "AO-cb9ee341-7aa775a7",
        name: "Cuimba",
        communes: [
          { id: "AO-cb9ee341-7aa775a7-7aa775a7", name: "Cuimba" },
          { id: "AO-cb9ee341-7aa775a7-b6b6fc0c", name: "Buela" },
          { id: "AO-cb9ee341-7aa775a7-f36df52d", name: "Luvaca" },
        ],
      },
      { id: "AO-cb9ee341-995fec8f", name: "Nóqui", communes: [] },
      { id: "AO-cb9ee341-dbbe0338", name: "Luvo", communes: [] },
      {
        id: "AO-cb9ee341-f77c091b",
        name: "Lufico",
        communes: [
          { id: "AO-cb9ee341-f77c091b-f77c091b", name: "Lufico" },
          { id: "AO-cb9ee341-f77c091b-c914de91", name: "Mpala" },
        ],
      },
      { id: "AO-cb9ee341-b75b2d46", name: "Quêlo", communes: [] },
      { id: "AO-cb9ee341-81176656", name: "Serra de Canda", communes: [] },
      {
        id: "AO-cb9ee341-d2f3bcc5",
        name: "Quindeje",
        communes: [
          { id: "AO-cb9ee341-d2f3bcc5-a210a14e", name: "Quibala - Norte" },
          { id: "AO-cb9ee341-d2f3bcc5-d2f3bcc5", name: "Quindeje" },
        ],
      },
    ],
  },
  {
    id: "AO-690b4d99",
    name: "Uíge",
    municipalities: [
      {
        id: "AO-690b4d99-cc1974c4",
        name: "Dange Quitexe",
        communes: [
          { id: "AO-690b4d99-cc1974c4-333cd698", name: "Quitexe" },
          { id: "AO-690b4d99-cc1974c4-9c82a44f", name: "Aldeia Viçosa" },
        ],
      },
      { id: "AO-690b4d99-3b6690e2", name: "Bungo", communes: [] },
      { id: "AO-690b4d99-b340e05b", name: "Ambuíla", communes: [] },
      {
        id: "AO-690b4d99-47ecebee",
        name: "Negage",
        communes: [
          { id: "AO-690b4d99-47ecebee-47ecebee", name: "Negage" },
          { id: "AO-690b4d99-47ecebee-412e9098", name: "Dimuca" },
          { id: "AO-690b4d99-47ecebee-ade35b5d", name: "Quisseque" },
        ],
      },
      { id: "AO-690b4d99-847ce587", name: "Puri", communes: [] },
      {
        id: "AO-690b4d99-f5a7c720",
        name: "Maquela do Zombo",
        communes: [
          { id: "AO-690b4d99-f5a7c720-f5a7c720", name: "Maquela do Zombo" },
          { id: "AO-690b4d99-f5a7c720-7e11da84", name: "Quibocolo" },
        ],
      },
      {
        id: "AO-690b4d99-144f6a89",
        name: "Damba",
        communes: [
          { id: "AO-690b4d99-144f6a89-144f6a89", name: "Damba" },
          { id: "AO-690b4d99-144f6a89-9dcbdfcd", name: "Petecusso" },
          { id: "AO-690b4d99-144f6a89-aed0d22f", name: "Camatambo" },
          { id: "AO-690b4d99-144f6a89-f697d40d", name: "Lêmboa" },
        ],
      },
      {
        id: "AO-690b4d99-7a4c790d",
        name: "Sanza Pombo",
        communes: [
          { id: "AO-690b4d99-7a4c790d-7a4c790d", name: "Sanza Pombo" },
          { id: "AO-690b4d99-7a4c790d-18073605", name: "Uamba" },
          { id: "AO-690b4d99-7a4c790d-3c10884c", name: "Cuilo Pombo" },
          { id: "AO-690b4d99-7a4c790d-3ce20423", name: "Alfândega" },
        ],
      },
      {
        id: "AO-690b4d99-ac267db2",
        name: "Bembe",
        communes: [
          { id: "AO-690b4d99-ac267db2-ac267db2", name: "Bembe" },
          { id: "AO-690b4d99-ac267db2-820736c4", name: "Mabaia" },
        ],
      },
      {
        id: "AO-690b4d99-f94f4c22",
        name: "Milunga",
        communes: [
          { id: "AO-690b4d99-f94f4c22-f94f4c22", name: "Milunga" },
          { id: "AO-690b4d99-f94f4c22-8dde3627", name: "Macocola" },
        ],
      },
      {
        id: "AO-690b4d99-8c8b82cf",
        name: "Songo",
        communes: [
          { id: "AO-690b4d99-8c8b82cf-8c8b82cf", name: "Songo" },
          { id: "AO-690b4d99-8c8b82cf-de57b005", name: "Quivuenga" },
        ],
      },
      {
        id: "AO-690b4d99-f05feb38",
        name: "Quimbele",
        communes: [
          { id: "AO-690b4d99-f05feb38-f05feb38", name: "Quimbele" },
          { id: "AO-690b4d99-f05feb38-58961745", name: "Icoca" },
        ],
      },
      {
        id: "AO-690b4d99-546bafc0",
        name: "Cangola",
        communes: [
          { id: "AO-690b4d99-546bafc0-546bafc0", name: "Cangola" },
          { id: "AO-690b4d99-546bafc0-866da995", name: "Bengo" },
          { id: "AO-690b4d99-546bafc0-698e82d3", name: "Caiongo" },
        ],
      },
      {
        id: "AO-690b4d99-690b4d99",
        name: "Uíge",
        communes: [
          { id: "AO-690b4d99-690b4d99-690b4d99", name: "Uíge" },
          { id: "AO-690b4d99-690b4d99-c2c3a2ed", name: "Luanga" },
          { id: "AO-690b4d99-690b4d99-178f23dc", name: "Casseche" },
          { id: "AO-690b4d99-690b4d99-1cc41695", name: "Cancungo" },
        ],
      },
      {
        id: "AO-690b4d99-e07ff6ea",
        name: "Mucaba",
        communes: [
          { id: "AO-690b4d99-e07ff6ea-e07ff6ea", name: "Mucaba" },
          { id: "AO-690b4d99-e07ff6ea-b5862fb7", name: "Uando Mucaba" },
        ],
      },
      {
        id: "AO-690b4d99-5598c6cc",
        name: "Nova Esperança",
        communes: [
          { id: "AO-690b4d99-5598c6cc-5598c6cc", name: "Nova Esperança" },
          { id: "AO-690b4d99-5598c6cc-c06c5082", name: "Buenga - Sul" },
          { id: "AO-690b4d99-5598c6cc-dfc98eef", name: "Cuilo Camboso" },
        ],
      },
      {
        id: "AO-690b4d99-941ef06f",
        name: "Sacandica",
        communes: [
          { id: "AO-690b4d99-941ef06f-941ef06f", name: "Sacandica" },
          { id: "AO-690b4d99-941ef06f-481116b0", name: "Cuilo Futa" },
          { id: "AO-690b4d99-941ef06f-82673b9c", name: "Béu" },
        ],
      },
      { id: "AO-690b4d99-823e5ae4", name: "Nsosso", communes: [] },
      { id: "AO-690b4d99-d50ce8ea", name: "Lucunga", communes: [] },
      { id: "AO-690b4d99-4d0c7777", name: "Quipedro", communes: [] },
      {
        id: "AO-690b4d99-09a02485",
        name: "Massau",
        communes: [
          { id: "AO-690b4d99-09a02485-09a02485", name: "Massau" },
          { id: "AO-690b4d99-09a02485-42f09a31", name: "Macolo" },
        ],
      },
      {
        id: "AO-690b4d99-1cf91afe",
        name: "Vista Alegre",
        communes: [
          { id: "AO-690b4d99-1cf91afe-1cf91afe", name: "Vista Alegre" },
          { id: "AO-690b4d99-1cf91afe-e574f609", name: "Cambamba" },
        ],
      },
      {
        id: "AO-690b4d99-6f51b42e",
        name: "Alto Zaza",
        communes: [
          { id: "AO-690b4d99-6f51b42e-6f51b42e", name: "Alto Zaza" },
          { id: "AO-690b4d99-6f51b42e-1c03c1ce", name: "Cuango Calumbo" },
        ],
      },
    ],
  },
  {
    id: "AO-866da995",
    name: "Bengo",
    municipalities: [
      {
        id: "AO-866da995-4c298298",
        name: "Dande",
        communes: [
          { id: "AO-866da995-4c298298-71d7a901", name: "Caxito" },
          { id: "AO-866da995-4c298298-2be6c6cf", name: "Mabubas" },
          { id: "AO-866da995-4c298298-3fcb004e", name: "Quicabo" },
        ],
      },
      {
        id: "AO-866da995-27bbedf2",
        name: "Quibaxe",
        communes: [
          { id: "AO-866da995-27bbedf2-27bbedf2", name: "Quibaxe" },
          { id: "AO-866da995-27bbedf2-6b367efa", name: "Paredes" },
          { id: "AO-866da995-27bbedf2-8de2fa8c", name: "Coxe" },
        ],
      },
      {
        id: "AO-866da995-e4ec6fb8",
        name: "Muxaluando",
        communes: [
          { id: "AO-866da995-e4ec6fb8-e4ec6fb8", name: "Muxaluando" },
          { id: "AO-866da995-e4ec6fb8-6f1d6ae9", name: "Quixico" },
          { id: "AO-866da995-e4ec6fb8-99d891f9", name: "Cage Mazumbo" },
        ],
      },
      {
        id: "AO-866da995-425abd7c",
        name: "Bula Atumba",
        communes: [
          { id: "AO-866da995-425abd7c-425abd7c", name: "Bula Atumba" },
          { id: "AO-866da995-425abd7c-44463009", name: "Quiage" },
        ],
      },
      {
        id: "AO-866da995-670fee49",
        name: "Ambriz",
        communes: [
          { id: "AO-866da995-670fee49-670fee49", name: "Ambriz" },
          { id: "AO-866da995-670fee49-4cbfa450", name: "Bela Vista" },
          { id: "AO-866da995-670fee49-a2426c74", name: "Tabi" },
        ],
      },
      {
        id: "AO-866da995-d22f0081",
        name: "Pango Aluquém",
        communes: [
          { id: "AO-866da995-d22f0081-d22f0081", name: "Pango Aluquém" },
          { id: "AO-866da995-d22f0081-1e95c556", name: "Cazuangongo" },
        ],
      },
      { id: "AO-866da995-76ec0e0a", name: "Barra do Dande", communes: [] },
      { id: "AO-866da995-d12a58b1", name: "Piri", communes: [] },
      { id: "AO-866da995-8d491bee", name: "Quicunzo", communes: [] },
      {
        id: "AO-866da995-3b02b161",
        name: "Nambuangongo",
        communes: [
          { id: "AO-866da995-3b02b161-bc62eccf", name: "Gombe" },
          { id: "AO-866da995-3b02b161-4b0b60b9", name: "Canacassala" },
          { id: "AO-866da995-3b02b161-4601cf76", name: "Zala" },
        ],
      },
      { id: "AO-866da995-11892ff1", name: "Úcua", communes: [] },
      { id: "AO-866da995-e522726c", name: "Panguila", communes: [] },
    ],
  },
  {
    id: "AO-d0253c96",
    name: "Luanda",
    municipalities: [
      { id: "AO-d0253c96-41e8a7b1", name: "Ingombota", communes: [] },
      {
        id: "AO-d0253c96-5c8439c0",
        name: "Cacuaco",
        communes: [
          { id: "AO-d0253c96-5c8439c0-5c8439c0", name: "Cacuaco" },
          { id: "AO-d0253c96-5c8439c0-fced4c6e", name: "Kikolo" },
        ],
      },
      {
        id: "AO-d0253c96-55577cf5",
        name: "Cazenga",
        communes: [
          { id: "AO-d0253c96-55577cf5-55577cf5", name: "Cazenga" },
          { id: "AO-d0253c96-55577cf5-27232e16", name: "Kima Kieza" },
        ],
      },
      { id: "AO-d0253c96-87ecca8f", name: "Viana", communes: [] },
      {
        id: "AO-d0253c96-42b6ad06",
        name: "Belas",
        communes: [
          { id: "AO-d0253c96-42b6ad06-fd7b62e9", name: "Barra do Cuanza" },
          { id: "AO-d0253c96-42b6ad06-0dd05af8", name: "Cabolombo" },
          { id: "AO-d0253c96-42b6ad06-d50dfd56", name: "Ramiros" },
        ],
      },
      {
        id: "AO-d0253c96-b6442132",
        name: "Kilamba Kiaxi",
        communes: [
          { id: "AO-d0253c96-b6442132-7e279607", name: "Golfe" },
          { id: "AO-d0253c96-b6442132-0f11d68a", name: "Nova Vida" },
        ],
      },
      {
        id: "AO-d0253c96-4974d067",
        name: "Talatona",
        communes: [
          { id: "AO-d0253c96-4974d067-6c0c5d8f", name: "Benfica" },
          { id: "AO-d0253c96-4974d067-4974d067", name: "Talatona" },
        ],
      },
      { id: "AO-d0253c96-78a7dab8", name: "Mussulo", communes: [] },
      { id: "AO-d0253c96-998b1529", name: "Sambizanga", communes: [] },
      { id: "AO-d0253c96-e031d40a", name: "Rangel", communes: [] },
      { id: "AO-d0253c96-8e5aced8", name: "Maianga", communes: [] },
      { id: "AO-d0253c96-d29dab1e", name: "Samba", communes: [] },
      { id: "AO-d0253c96-3a0089ed", name: "Camama", communes: [] },
      { id: "AO-d0253c96-69a216cc", name: "Mulenvos", communes: [] },
      {
        id: "AO-d0253c96-5f3a4888",
        name: "Kilamba",
        communes: [
          { id: "AO-d0253c96-5f3a4888-5f3a4888", name: "Kilamba" },
          { id: "AO-d0253c96-5f3a4888-52c68d19", name: "Vila Flôr" },
        ],
      },
      { id: "AO-d0253c96-11dedc3b", name: "Hoji ya Henda", communes: [] },
    ],
  },
  {
    id: "AO-5169047d",
    name: "Icolo e Bengo",
    municipalities: [
      {
        id: "AO-5169047d-87350327",
        name: "Catete",
        communes: [
          { id: "AO-5169047d-87350327-87350327", name: "Catete" },
          { id: "AO-5169047d-87350327-c630a511", name: "Cassoneca" },
          { id: "AO-5169047d-87350327-8a2eb87f", name: "Caculo Cahango" },
          { id: "AO-5169047d-87350327-ee50ca3c", name: "Caxicane" },
        ],
      },
      {
        id: "AO-5169047d-687231b3",
        name: "Quiçama",
        communes: [
          { id: "AO-5169047d-687231b3-f91b0780", name: "Muxima" },
          { id: "AO-5169047d-687231b3-dbc093bc", name: "Quixinge" },
          { id: "AO-5169047d-687231b3-cf67798a", name: "Demba Chio" },
          { id: "AO-5169047d-687231b3-128b7547", name: "Mumbondo" },
        ],
      },
      { id: "AO-5169047d-afcaa48e", name: "Calumbo", communes: [] },
      { id: "AO-5169047d-70a74339", name: "Cabiri", communes: [] },
      { id: "AO-5169047d-1f638077", name: "Cabo Ledo", communes: [] },
      { id: "AO-5169047d-da33bf3b", name: "Bom Jesus", communes: [] },
      {
        id: "AO-5169047d-c71511f7",
        name: "Sequele",
        communes: [
          { id: "AO-5169047d-c71511f7-2b74fad9", name: "Funda" },
          { id: "AO-5169047d-c71511f7-bb9af778", name: "Quifangondo" },
          { id: "AO-5169047d-c71511f7-c71511f7", name: "Sequele" },
        ],
      },
    ],
  },
  {
    id: "AO-98c449e8",
    name: "Cuanza Norte",
    municipalities: [
      {
        id: "AO-98c449e8-edf84c0d",
        name: "Cazengo",
        communes: [
          { id: "AO-98c449e8-edf84c0d-98570011", name: "Ndalatando" },
          { id: "AO-98c449e8-edf84c0d-a3e26593", name: "Caculo Camuiza" },
        ],
      },
      {
        id: "AO-98c449e8-290f4a1c",
        name: "Golungo Alto",
        communes: [
          { id: "AO-98c449e8-290f4a1c-290f4a1c", name: "Golungo Alto" },
          { id: "AO-98c449e8-290f4a1c-f9d0d3bd", name: "Cambondo" },
          { id: "AO-98c449e8-290f4a1c-b69037fb", name: "Quilombo quía Puto" },
        ],
      },
      {
        id: "AO-98c449e8-1770f5d9",
        name: "Cambambe",
        communes: [
          { id: "AO-98c449e8-1770f5d9-41c3739f", name: "Dondo" },
          { id: "AO-98c449e8-1770f5d9-83a8be9e", name: "Dange ya Menha" },
          {
            id: "AO-98c449e8-1770f5d9-f836aa8f",
            name: "São Pedro da Quilemba",
          },
        ],
      },
      {
        id: "AO-98c449e8-1348d571",
        name: "Samba Cajú",
        communes: [
          { id: "AO-98c449e8-1348d571-1348d571", name: "Samba Cajú" },
          { id: "AO-98c449e8-1348d571-5bb5a50b", name: "Samba Lucala" },
        ],
      },
      {
        id: "AO-98c449e8-08ae3ebc",
        name: "Ambaca",
        communes: [
          { id: "AO-98c449e8-08ae3ebc-f4c5c6ea", name: "Camabatela" },
          { id: "AO-98c449e8-08ae3ebc-3de1b7c3", name: "Máua" },
          { id: "AO-98c449e8-08ae3ebc-6bdbb7a8", name: "Bindo" },
        ],
      },
      {
        id: "AO-98c449e8-450805c0",
        name: "Lucala",
        communes: [
          { id: "AO-98c449e8-450805c0-450805c0", name: "Lucala" },
          { id: "AO-98c449e8-450805c0-760c19e8", name: "Quiangombe" },
        ],
      },
      {
        id: "AO-98c449e8-2d174d74",
        name: "Banga",
        communes: [
          { id: "AO-98c449e8-2d174d74-2d174d74", name: "Banga" },
          { id: "AO-98c449e8-2d174d74-21f20de3", name: "Cariamba" },
        ],
      },
      { id: "AO-98c449e8-0291de45", name: "Bolongongo", communes: [] },
      { id: "AO-98c449e8-d5eee944", name: "Quiculungo", communes: [] },
      {
        id: "AO-98c449e8-81cd9720",
        name: "Ngonguembo",
        communes: [
          { id: "AO-98c449e8-81cd9720-6e98c6de", name: "Quilombo dos Dembos" },
          { id: "AO-98c449e8-81cd9720-f71a2fdf", name: "Camame" },
          { id: "AO-98c449e8-81cd9720-9a73582e", name: "Cavunga" },
        ],
      },
      {
        id: "AO-98c449e8-8d2af2ae",
        name: "Massangano",
        communes: [
          { id: "AO-98c449e8-8d2af2ae-8d2af2ae", name: "Massangano" },
          { id: "AO-98c449e8-8d2af2ae-7c1fcc11", name: "Zenza do Itombe" },
        ],
      },
      { id: "AO-98c449e8-f5a95b8e", name: "Cêrca", communes: [] },
      { id: "AO-98c449e8-43034a4d", name: "Tango", communes: [] },
      {
        id: "AO-98c449e8-2b7d085b",
        name: "Terreiro",
        communes: [
          { id: "AO-98c449e8-2b7d085b-2b7d085b", name: "Terreiro" },
          { id: "AO-98c449e8-2b7d085b-2de3aee9", name: "Quiquiemba" },
        ],
      },
      { id: "AO-98c449e8-74064464", name: "Aldeia Nova", communes: [] },
      { id: "AO-98c449e8-82c36b8e", name: "Caculo Cabaça", communes: [] },
      { id: "AO-98c449e8-81979c23", name: "Luinga", communes: [] },
    ],
  },
  {
    id: "AO-81f925af",
    name: "Cuanza Sul",
    municipalities: [
      {
        id: "AO-81f925af-86427d47",
        name: "Sumbe",
        communes: [
          { id: "AO-81f925af-86427d47-86427d47", name: "Sumbe" },
          { id: "AO-81f925af-86427d47-a0fa7583", name: "Quicombo" },
        ],
      },
      {
        id: "AO-81f925af-dc847e07",
        name: "Calulo",
        communes: [
          { id: "AO-81f925af-dc847e07-dc847e07", name: "Calulo" },
          { id: "AO-81f925af-dc847e07-7032fdcc", name: "Cabuta" },
        ],
      },
      {
        id: "AO-81f925af-3d56afe2",
        name: "Gabela",
        communes: [
          { id: "AO-81f925af-3d56afe2-3d56afe2", name: "Gabela" },
          { id: "AO-81f925af-3d56afe2-b88a5832", name: "Assango" },
        ],
      },
      {
        id: "AO-81f925af-73c92808",
        name: "Cassongue",
        communes: [
          { id: "AO-81f925af-73c92808-73c92808", name: "Cassongue" },
          { id: "AO-81f925af-73c92808-6907016d", name: "Atóme" },
          { id: "AO-81f925af-73c92808-e8e026b7", name: "Dumbi" },
        ],
      },
      {
        id: "AO-81f925af-bf3c565f",
        name: "Porto Amboím",
        communes: [
          { id: "AO-81f925af-bf3c565f-bf3c565f", name: "Porto Amboím" },
          { id: "AO-81f925af-bf3c565f-61af1ff3", name: "Capolo" },
        ],
      },
      {
        id: "AO-81f925af-49132108",
        name: "Quibala",
        communes: [
          { id: "AO-81f925af-49132108-49132108", name: "Quibala" },
          { id: "AO-81f925af-49132108-7a4296a8", name: "Dala Cachibo" },
        ],
      },
      {
        id: "AO-81f925af-25742c04",
        name: "Seles",
        communes: [
          { id: "AO-81f925af-25742c04-25742c04", name: "Seles" },
          { id: "AO-81f925af-25742c04-4ff56836", name: "Botera" },
        ],
      },
      { id: "AO-81f925af-3ce8255e", name: "Waku Kungo", communes: [] },
      {
        id: "AO-81f925af-a71232f6",
        name: "Mussende",
        communes: [
          { id: "AO-81f925af-a71232f6-a71232f6", name: "Mussende" },
          { id: "AO-81f925af-a71232f6-607e3fcb", name: "Quipaxi" },
        ],
      },
      { id: "AO-81f925af-d4c3ef55", name: "Quilenda", communes: [] },
      {
        id: "AO-81f925af-b9cda50b",
        name: "Ebo",
        communes: [
          { id: "AO-81f925af-b9cda50b-b9cda50b", name: "Ebo" },
          { id: "AO-81f925af-b9cda50b-a11f41e4", name: "Cassanje" },
        ],
      },
      {
        id: "AO-81f925af-ecf2e3b2",
        name: "Conda",
        communes: [
          { id: "AO-81f925af-ecf2e3b2-ecf2e3b2", name: "Conda" },
          { id: "AO-81f925af-ecf2e3b2-575e606a", name: "Cunjo" },
        ],
      },
      { id: "AO-81f925af-11418343", name: "Quirimbo", communes: [] },
      { id: "AO-81f925af-5f206229", name: "Munenga", communes: [] },
      { id: "AO-81f925af-a581dca8", name: "Quissongo", communes: [] },
      { id: "AO-81f925af-edcb2701", name: "Gungo", communes: [] },
      { id: "AO-81f925af-2299a657", name: "Sanga", communes: [] },
      { id: "AO-81f925af-a8ae9635", name: "Gangula", communes: [] },
      { id: "AO-81f925af-dd7e0cc3", name: "Pambangala", communes: [] },
      { id: "AO-81f925af-58782c95", name: "Condé", communes: [] },
      { id: "AO-81f925af-9c1d19e9", name: "Amboiva", communes: [] },
      {
        id: "AO-81f925af-dad87bd0",
        name: "Lonhe",
        communes: [
          { id: "AO-81f925af-dad87bd0-dad87bd0", name: "Lonhe" },
          { id: "AO-81f925af-dad87bd0-893251d5", name: "Cariango" },
        ],
      },
      { id: "AO-81f925af-d71060fd", name: "Quenha", communes: [] },
      { id: "AO-81f925af-ac989d2b", name: "Boa Entrada", communes: [] },
    ],
  },
  {
    id: "AO-d58cb05b",
    name: "Malanje",
    municipalities: [
      {
        id: "AO-d58cb05b-c089b67a",
        name: "Calandula",
        communes: [
          { id: "AO-d58cb05b-c089b67a-c089b67a", name: "Calandula" },
          { id: "AO-d58cb05b-c089b67a-360909ca", name: "Cota" },
        ],
      },
      {
        id: "AO-d58cb05b-d58cb05b",
        name: "Malanje",
        communes: [
          { id: "AO-d58cb05b-d58cb05b-d58cb05b", name: "Malanje" },
          { id: "AO-d58cb05b-d58cb05b-3ac06ab2", name: "Lombe" },
        ],
      },
      {
        id: "AO-d58cb05b-589dd14b",
        name: "Cacuso",
        communes: [
          { id: "AO-d58cb05b-589dd14b-589dd14b", name: "Cacuso" },
          { id: "AO-d58cb05b-589dd14b-f50f44e3", name: "Soqueco" },
        ],
      },
      { id: "AO-d58cb05b-ff8465f1", name: "Massango", communes: [] },
      {
        id: "AO-d58cb05b-c6fee13d",
        name: "Marimba",
        communes: [
          { id: "AO-d58cb05b-c6fee13d-c6fee13d", name: "Marimba" },
          { id: "AO-d58cb05b-c6fee13d-775c623b", name: "Mangando" },
        ],
      },
      {
        id: "AO-d58cb05b-478cdf05",
        name: "Quela",
        communes: [
          { id: "AO-d58cb05b-478cdf05-478cdf05", name: "Quela" },
          { id: "AO-d58cb05b-478cdf05-93829c98", name: "Bângalas" },
        ],
      },
      {
        id: "AO-d58cb05b-85d3c2fd",
        name: "Quirima",
        communes: [
          { id: "AO-d58cb05b-85d3c2fd-85d3c2fd", name: "Quirima" },
          { id: "AO-d58cb05b-85d3c2fd-a6e9cc4e", name: "Sautar" },
        ],
      },
      {
        id: "AO-d58cb05b-7d1594ea",
        name: "Cangandala",
        communes: [
          { id: "AO-d58cb05b-7d1594ea-7d1594ea", name: "Cangandala" },
          { id: "AO-d58cb05b-7d1594ea-bcdd1307", name: "Caribo" },
          { id: "AO-d58cb05b-7d1594ea-a29d7c72", name: "Culamagia" },
        ],
      },
      {
        id: "AO-d58cb05b-55d59637",
        name: "Cahombo",
        communes: [
          { id: "AO-d58cb05b-55d59637-55d59637", name: "Cahombo" },
          { id: "AO-d58cb05b-55d59637-bff10743", name: "Micanda" },
        ],
      },
      {
        id: "AO-d58cb05b-3377a5ec",
        name: "Kunda dya Baze",
        communes: [
          { id: "AO-d58cb05b-3377a5ec-3377a5ec", name: "Kunda dya Baze" },
          { id: "AO-d58cb05b-3377a5ec-a9bfd4ab", name: "Lemba" },
        ],
      },
      {
        id: "AO-d58cb05b-af510c9a",
        name: "Cambundi Catembo",
        communes: [
          { id: "AO-d58cb05b-af510c9a-af510c9a", name: "Cambundi Catembo" },
          { id: "AO-d58cb05b-af510c9a-eb866ebb", name: "Dumba Cambango" },
        ],
      },
      {
        id: "AO-d58cb05b-2dd5887b",
        name: "Caculama",
        communes: [
          { id: "AO-d58cb05b-2dd5887b-2dd5887b", name: "Caculama" },
          { id: "AO-d58cb05b-2dd5887b-19fd4712", name: "Caxinga" },
        ],
      },
      {
        id: "AO-d58cb05b-fe3185d4",
        name: "Kiwaba Nzoji",
        communes: [
          { id: "AO-d58cb05b-fe3185d4-fe3185d4", name: "Kiwaba Nzoji" },
          { id: "AO-d58cb05b-fe3185d4-0d5cc65a", name: "Mufuma" },
        ],
      },
      {
        id: "AO-d58cb05b-9c2d2209",
        name: "Luquembo",
        communes: [
          { id: "AO-d58cb05b-9c2d2209-9c2d2209", name: "Luquembo" },
          { id: "AO-d58cb05b-9c2d2209-9f699564", name: "Dombo wa Zanga" },
        ],
      },
      { id: "AO-d58cb05b-aa9f2aaf", name: "Cateco Cangola", communes: [] },
      {
        id: "AO-d58cb05b-402f2b1e",
        name: "Mbanji ya Ngola",
        communes: [
          { id: "AO-d58cb05b-402f2b1e-402f2b1e", name: "Mbanji ya Ngola" },
          { id: "AO-d58cb05b-402f2b1e-c4debad4", name: "Cabombo" },
        ],
      },
      { id: "AO-d58cb05b-d0ccb640", name: "Cuale", communes: [] },
      { id: "AO-d58cb05b-5faa877a", name: "Pungu a Ndongo", communes: [] },
      {
        id: "AO-d58cb05b-0cd65109",
        name: "Ngola Luiji",
        communes: [
          { id: "AO-d58cb05b-0cd65109-0cd65109", name: "Ngola Luiji" },
          { id: "AO-d58cb05b-0cd65109-58fdf814", name: "Cambaxe" },
        ],
      },
      {
        id: "AO-d58cb05b-83c0a75f",
        name: "Quihuhu",
        communes: [
          { id: "AO-d58cb05b-83c0a75f-83c0a75f", name: "Quihuhu" },
          { id: "AO-d58cb05b-83c0a75f-01319e9a", name: "Quinguengue" },
        ],
      },
      {
        id: "AO-d58cb05b-8b707317",
        name: "Xandel",
        communes: [
          { id: "AO-d58cb05b-8b707317-8b707317", name: "Xandel" },
          { id: "AO-d58cb05b-8b707317-19a96e1e", name: "Moma" },
        ],
      },
      { id: "AO-d58cb05b-25e622d4", name: "Cambo Suinginge", communes: [] },
      { id: "AO-d58cb05b-d6117c41", name: "Milando", communes: [] },
      { id: "AO-d58cb05b-19dba3c1", name: "Quitapa", communes: [] },
      {
        id: "AO-d58cb05b-64b6abdc",
        name: "Capunda",
        communes: [
          { id: "AO-d58cb05b-64b6abdc-64b6abdc", name: "Capunda" },
          { id: "AO-d58cb05b-64b6abdc-e7e86b6d", name: "Quimbango" },
          { id: "AO-d58cb05b-64b6abdc-f6df6b1c", name: "Cunga Palanga" },
        ],
      },
      { id: "AO-d58cb05b-a2df7838", name: "Muquixe", communes: [] },
      { id: "AO-d58cb05b-4211253c", name: "Quêssua", communes: [] },
    ],
  },
  {
    id: "AO-f7fc2f44",
    name: "Lunda Norte",
    municipalities: [
      {
        id: "AO-f7fc2f44-01fed1c6",
        name: "Cuilo",
        communes: [
          { id: "AO-f7fc2f44-01fed1c6-01fed1c6", name: "Cuilo" },
          { id: "AO-f7fc2f44-01fed1c6-d94c3d11", name: "Caluango" },
        ],
      },
      {
        id: "AO-f7fc2f44-ca1d6545",
        name: "Dundo",
        communes: [
          { id: "AO-f7fc2f44-ca1d6545-ca1d6545", name: "Dundo" },
          { id: "AO-f7fc2f44-ca1d6545-eda8f9d7", name: "Luachimo" },
        ],
      },
      {
        id: "AO-f7fc2f44-5b7fa930",
        name: "Lubalo",
        communes: [
          { id: "AO-f7fc2f44-5b7fa930-5b7fa930", name: "Lubalo" },
          { id: "AO-f7fc2f44-5b7fa930-80cce932", name: "Muvuluege" },
        ],
      },
      {
        id: "AO-f7fc2f44-84ca6e13",
        name: "Capenda Camulemba",
        communes: [
          { id: "AO-f7fc2f44-84ca6e13-84ca6e13", name: "Capenda Camulemba" },
          { id: "AO-f7fc2f44-84ca6e13-a8925aa8", name: "Xinge" },
        ],
      },
      { id: "AO-f7fc2f44-bfab1c5b", name: "Cuango", communes: [] },
      {
        id: "AO-f7fc2f44-a187a945",
        name: "Lucapa",
        communes: [
          { id: "AO-f7fc2f44-a187a945-a187a945", name: "Lucapa" },
          { id: "AO-f7fc2f44-a187a945-b4afff78", name: "Camissombo" },
        ],
      },
      {
        id: "AO-f7fc2f44-99b84133",
        name: "Cambulo",
        communes: [
          { id: "AO-f7fc2f44-99b84133-e9ed2bc3", name: "Nzage" },
          { id: "AO-f7fc2f44-99b84133-fbfba0f1", name: "Cachimo" },
        ],
      },
      { id: "AO-f7fc2f44-27394b83", name: "Xá Muteba", communes: [] },
      { id: "AO-f7fc2f44-90dc03fd", name: "Caungula", communes: [] },
      { id: "AO-f7fc2f44-10bebd40", name: "Lóvua", communes: [] },
      { id: "AO-f7fc2f44-3079e33f", name: "Chitato", communes: [] },
      {
        id: "AO-f7fc2f44-f6e46dc9",
        name: "Xá Cassau",
        communes: [
          { id: "AO-f7fc2f44-f6e46dc9-f6e46dc9", name: "Xá Cassau" },
          { id: "AO-f7fc2f44-f6e46dc9-2e3285ba", name: "Capaia" },
        ],
      },
      { id: "AO-f7fc2f44-29170bb2", name: "Camaxilo", communes: [] },
      { id: "AO-f7fc2f44-84533493", name: "Luangue", communes: [] },
      { id: "AO-f7fc2f44-9bb89883", name: "Luremo", communes: [] },
      {
        id: "AO-f7fc2f44-bd89777d",
        name: "Canzar",
        communes: [
          { id: "AO-f7fc2f44-bd89777d-bd89777d", name: "Canzar" },
          { id: "AO-f7fc2f44-bd89777d-19fcbaee", name: "Luia" },
        ],
      },
      {
        id: "AO-f7fc2f44-7be9beb3",
        name: "Cassanje Calucala",
        communes: [
          { id: "AO-f7fc2f44-7be9beb3-7be9beb3", name: "Cassanje Calucala" },
          { id: "AO-f7fc2f44-7be9beb3-fed09720", name: "Iongo" },
        ],
      },
      {
        id: "AO-f7fc2f44-a30c25b1",
        name: "Mussungue",
        communes: [
          { id: "AO-f7fc2f44-a30c25b1-a30c25b1", name: "Mussungue" },
          { id: "AO-f7fc2f44-a30c25b1-26217597", name: "Caíta" },
        ],
      },
      { id: "AO-f7fc2f44-8b3fadc9", name: "Cafunfo", communes: [] },
    ],
  },
  {
    id: "AO-664a20f2",
    name: "Lunda Sul",
    municipalities: [
      {
        id: "AO-664a20f2-1bf14dbc",
        name: "Saurimo",
        communes: [
          { id: "AO-664a20f2-1bf14dbc-1bf14dbc", name: "Saurimo" },
          { id: "AO-664a20f2-1bf14dbc-f3d48c4a", name: "Mona Quimbundo" },
        ],
      },
      { id: "AO-664a20f2-00679685", name: "Muconda", communes: [] },
      { id: "AO-664a20f2-7c7c0ec0", name: "Cacolo", communes: [] },
      { id: "AO-664a20f2-b6deda13", name: "Dala", communes: [] },
      { id: "AO-664a20f2-c76ca95b", name: "Chiluage", communes: [] },
      { id: "AO-664a20f2-1e18ef90", name: "Cassai-Sul", communes: [] },
      {
        id: "AO-664a20f2-58622ea9",
        name: "Xassengue",
        communes: [
          { id: "AO-664a20f2-58622ea9-58622ea9", name: "Xassengue" },
          { id: "AO-664a20f2-58622ea9-41785743", name: "Cucumbi" },
        ],
      },
      { id: "AO-664a20f2-85320020", name: "Alto Chicapa", communes: [] },
      { id: "AO-664a20f2-7165fa1d", name: "Sombo", communes: [] },
      { id: "AO-664a20f2-af94d2f0", name: "Muriege", communes: [] },
      { id: "AO-664a20f2-1bbaaa03", name: "Luma Cassai", communes: [] },
      { id: "AO-664a20f2-08e256b1", name: "Cazage", communes: [] },
      { id: "AO-664a20f2-1f08e983", name: "Muangueji", communes: [] },
      { id: "AO-664a20f2-92ddf9d2", name: "Cassengo", communes: [] },
    ],
  },
  {
    id: "AO-65cf3bf2",
    name: "Moxico",
    municipalities: [
      {
        id: "AO-65cf3bf2-2e9b4a8d",
        name: "Luena",
        communes: [
          { id: "AO-65cf3bf2-2e9b4a8d-2e9b4a8d", name: "Luena" },
          { id: "AO-65cf3bf2-2e9b4a8d-42d77521", name: "Cassongo" },
        ],
      },
      {
        id: "AO-65cf3bf2-9ea4eb3a",
        name: "Cangamba",
        communes: [
          { id: "AO-65cf3bf2-9ea4eb3a-2e206325", name: "Cangombe" },
          { id: "AO-65cf3bf2-9ea4eb3a-619995b3", name: "Cassamba" },
          { id: "AO-65cf3bf2-9ea4eb3a-9ea4eb3a", name: "Cangamba" },
          { id: "AO-65cf3bf2-9ea4eb3a-bc52bc83", name: "Muié" },
        ],
      },
      {
        id: "AO-65cf3bf2-9e133cf9",
        name: "Lumbala Nguimbo",
        communes: [
          { id: "AO-65cf3bf2-9e133cf9-9e133cf9", name: "Lumbala Nguimbo" },
          { id: "AO-65cf3bf2-9e133cf9-e56ce806", name: "Mussuma Mitete" },
          { id: "AO-65cf3bf2-9e133cf9-63f4898e", name: "Sessa" },
        ],
      },
      { id: "AO-65cf3bf2-446a008f", name: "Camanongue", communes: [] },
      {
        id: "AO-65cf3bf2-3386c917",
        name: "Léua",
        communes: [
          { id: "AO-65cf3bf2-3386c917-3386c917", name: "Léua" },
          { id: "AO-65cf3bf2-3386c917-2f55c6d4", name: "Liangongo" },
        ],
      },
      {
        id: "AO-65cf3bf2-5f778a4e",
        name: "Lutembo",
        communes: [
          { id: "AO-65cf3bf2-5f778a4e-5f778a4e", name: "Lutembo" },
          { id: "AO-65cf3bf2-5f778a4e-0cb47009", name: "Luvuei" },
        ],
      },
      { id: "AO-65cf3bf2-e6c486ee", name: "Lucusse", communes: [] },
      { id: "AO-65cf3bf2-da0547c3", name: "Cangumbe", communes: [] },
      { id: "AO-65cf3bf2-35d0e0a4", name: "Chiúme", communes: [] },
      { id: "AO-65cf3bf2-120ee7dc", name: "Alto Cuito", communes: [] },
      { id: "AO-65cf3bf2-ac72a438", name: "Ninda", communes: [] },
      { id: "AO-65cf3bf2-8ef57f0b", name: "Lutuai", communes: [] },
    ],
  },
  {
    id: "AO-646a5b3d",
    name: "Moxico Leste",
    municipalities: [
      {
        id: "AO-646a5b3d-421251ff",
        name: "Cazombo",
        communes: [
          { id: "AO-646a5b3d-421251ff-421251ff", name: "Cazombo" },
          { id: "AO-646a5b3d-421251ff-d0296626", name: "Lumbala Caquengue" },
        ],
      },
      { id: "AO-646a5b3d-112f7e4c", name: "Luacano", communes: [] },
      { id: "AO-646a5b3d-1a13cfaf", name: "Cameia", communes: [] },
      { id: "AO-646a5b3d-5763d741", name: "Luau", communes: [] },
      { id: "AO-646a5b3d-7a9703ac", name: "Nana Candundo", communes: [] },
      {
        id: "AO-646a5b3d-7d0f5bd2",
        name: "Macondo",
        communes: [
          { id: "AO-646a5b3d-7d0f5bd2-7d0f5bd2", name: "Macondo" },
          { id: "AO-646a5b3d-7d0f5bd2-e0f24738", name: "Calunda" },
        ],
      },
      { id: "AO-646a5b3d-7597fdfd", name: "Caianda", communes: [] },
      { id: "AO-646a5b3d-9c3301a9", name: "Lóvua do Zambeze", communes: [] },
      { id: "AO-646a5b3d-2423534a", name: "Lago Dilolo", communes: [] },
    ],
  },
  {
    id: "AO-68397fb0",
    name: "Bié",
    municipalities: [
      {
        id: "AO-68397fb0-c15f3d00",
        name: "Andulo",
        communes: [
          { id: "AO-68397fb0-c15f3d00-c15f3d00", name: "Andulo" },
          { id: "AO-68397fb0-c15f3d00-718f8b93", name: "Cassumbe" },
          { id: "AO-68397fb0-c15f3d00-79c00d71", name: "Chivaúlo" },
        ],
      },
      {
        id: "AO-68397fb0-3f3e2d53",
        name: "Chitembo",
        communes: [
          { id: "AO-68397fb0-3f3e2d53-3f3e2d53", name: "Chitembo" },
          { id: "AO-68397fb0-3f3e2d53-80f9f6b9", name: "Cachingues" },
          { id: "AO-68397fb0-3f3e2d53-36162b5c", name: "Malengue" },
        ],
      },
      {
        id: "AO-68397fb0-f0d3697d",
        name: "Cuito",
        communes: [
          { id: "AO-68397fb0-f0d3697d-f0d3697d", name: "Cuito" },
          { id: "AO-68397fb0-f0d3697d-d89acb16", name: "Cunje" },
        ],
      },
      {
        id: "AO-68397fb0-6f58fb70",
        name: "Camacupa",
        communes: [
          { id: "AO-68397fb0-6f58fb70-6f58fb70", name: "Camacupa" },
          { id: "AO-68397fb0-6f58fb70-d8b46f29", name: "Cuanza" },
          { id: "AO-68397fb0-6f58fb70-c69e04c3", name: "Muinha" },
        ],
      },
      {
        id: "AO-68397fb0-bd209140",
        name: "Chinguar",
        communes: [
          { id: "AO-68397fb0-bd209140-bd209140", name: "Chinguar" },
          { id: "AO-68397fb0-bd209140-1fa1949a", name: "Cutato" },
          { id: "AO-68397fb0-bd209140-df098517", name: "Cangote" },
        ],
      },
      {
        id: "AO-68397fb0-7cbd829d",
        name: "Catabola",
        communes: [
          { id: "AO-68397fb0-7cbd829d-7cbd829d", name: "Catabola" },
          { id: "AO-68397fb0-7cbd829d-c8dd906e", name: "Caiuera" },
          { id: "AO-68397fb0-7cbd829d-881ea856", name: "Sande" },
        ],
      },
      { id: "AO-68397fb0-a022589e", name: "Cunhinga", communes: [] },
      {
        id: "AO-68397fb0-1d4ac867",
        name: "Cuemba",
        communes: [
          { id: "AO-68397fb0-1d4ac867-1d4ac867", name: "Cuemba" },
          { id: "AO-68397fb0-1d4ac867-d8d0c50e", name: "Munhango" },
          { id: "AO-68397fb0-1d4ac867-08265837", name: "Sachinemuna" },
        ],
      },
      {
        id: "AO-68397fb0-c1823259",
        name: "Nharêa",
        communes: [
          { id: "AO-68397fb0-c1823259-c1823259", name: "Nharêa" },
          { id: "AO-68397fb0-c1823259-e8c2d441", name: "Gamba" },
          { id: "AO-68397fb0-c1823259-9534b6f5", name: "Caieie" },
        ],
      },
      { id: "AO-68397fb0-47d9c447", name: "Luando", communes: [] },
      { id: "AO-68397fb0-cf37c4ea", name: "Ringoma", communes: [] },
      {
        id: "AO-68397fb0-21ff3203",
        name: "Mumbué",
        communes: [
          { id: "AO-68397fb0-21ff3203-21ff3203", name: "Mumbué" },
          { id: "AO-68397fb0-21ff3203-ac5eb44a", name: "Mutumbo" },
          { id: "AO-68397fb0-21ff3203-a7796f3a", name: "Soma Cuanza" },
        ],
      },
      { id: "AO-68397fb0-f840531e", name: "Calucinga", communes: [] },
      { id: "AO-68397fb0-547afcd8", name: "Chicala", communes: [] },
      {
        id: "AO-68397fb0-21ab3e81",
        name: "Chipeta",
        communes: [
          { id: "AO-68397fb0-21ab3e81-21ab3e81", name: "Chipeta" },
          { id: "AO-68397fb0-21ab3e81-550e3c3b", name: "Chiuca" },
        ],
      },
      { id: "AO-68397fb0-f0018190", name: "Umpulo", communes: [] },
      {
        id: "AO-68397fb0-e98ad63a",
        name: "Lúbia",
        communes: [
          { id: "AO-68397fb0-e98ad63a-e98ad63a", name: "Lúbia" },
          { id: "AO-68397fb0-e98ad63a-7e46d1a4", name: "Dando" },
        ],
      },
      { id: "AO-68397fb0-4f8379f5", name: "Cambândua", communes: [] },
      { id: "AO-68397fb0-a95096cb", name: "Belo Horizonte", communes: [] },
    ],
  },
  {
    id: "AO-210b5c8e",
    name: "Huambo",
    municipalities: [
      {
        id: "AO-210b5c8e-38532ade",
        name: "Bailundo",
        communes: [
          { id: "AO-210b5c8e-38532ade-38532ade", name: "Bailundo" },
          { id: "AO-210b5c8e-38532ade-4bb65a98", name: "Lunge" },
          { id: "AO-210b5c8e-38532ade-40a82927", name: "Luvemba" },
        ],
      },
      {
        id: "AO-210b5c8e-210b5c8e",
        name: "Huambo",
        communes: [
          { id: "AO-210b5c8e-210b5c8e-210b5c8e", name: "Huambo" },
          { id: "AO-210b5c8e-210b5c8e-b1ea206d", name: "Calima" },
        ],
      },
      {
        id: "AO-210b5c8e-180af0a1",
        name: "Londuimbali",
        communes: [
          { id: "AO-210b5c8e-180af0a1-180af0a1", name: "Londuimbali" },
          { id: "AO-210b5c8e-180af0a1-b39d9521", name: "Ussoque" },
        ],
      },
      { id: "AO-210b5c8e-6d6c2b82", name: "Caála", communes: [] },
      {
        id: "AO-210b5c8e-f9f34b99",
        name: "Chicala Choloanga",
        communes: [
          { id: "AO-210b5c8e-f9f34b99-547afcd8", name: "Chicala" },
          { id: "AO-210b5c8e-f9f34b99-977fe6b2", name: "Mbave" },
        ],
      },
      {
        id: "AO-210b5c8e-ee2975c0",
        name: "Cachiungo",
        communes: [
          { id: "AO-210b5c8e-ee2975c0-ee2975c0", name: "Cachiungo" },
          { id: "AO-210b5c8e-ee2975c0-881500ed", name: "Chinhama" },
        ],
      },
      {
        id: "AO-210b5c8e-262cb375",
        name: "Mungo",
        communes: [
          { id: "AO-210b5c8e-262cb375-262cb375", name: "Mungo" },
          { id: "AO-210b5c8e-262cb375-1355cb41", name: "Cambuengo" },
        ],
      },
      {
        id: "AO-210b5c8e-08ee9a69",
        name: "Longonjo",
        communes: [
          { id: "AO-210b5c8e-08ee9a69-08ee9a69", name: "Longonjo" },
          { id: "AO-210b5c8e-08ee9a69-cc7e1dec", name: "Lépi" },
        ],
      },
      {
        id: "AO-210b5c8e-489a8335",
        name: "Ucuma",
        communes: [
          { id: "AO-210b5c8e-489a8335-489a8335", name: "Ucuma" },
          { id: "AO-210b5c8e-489a8335-3750913b", name: "Cacoma" },
          { id: "AO-210b5c8e-489a8335-72d9f1d9", name: "Mundundo" },
        ],
      },
      {
        id: "AO-210b5c8e-035f9e3c",
        name: "Ecunha",
        communes: [
          { id: "AO-210b5c8e-035f9e3c-035f9e3c", name: "Ecunha" },
          { id: "AO-210b5c8e-035f9e3c-dbccfbbb", name: "Quipeio" },
        ],
      },
      {
        id: "AO-210b5c8e-79f5fb85",
        name: "Chinjenje",
        communes: [
          { id: "AO-210b5c8e-79f5fb85-79f5fb85", name: "Chinjenje" },
          { id: "AO-210b5c8e-79f5fb85-4bfa4bbd", name: "Chiaca" },
        ],
      },
      {
        id: "AO-210b5c8e-f481c51b",
        name: "Bimbe",
        communes: [
          { id: "AO-210b5c8e-f481c51b-f481c51b", name: "Bimbe" },
          { id: "AO-210b5c8e-f481c51b-26c2d3e3", name: "Hengue" },
        ],
      },
      {
        id: "AO-210b5c8e-60953ad8",
        name: "Sambo",
        communes: [
          { id: "AO-210b5c8e-60953ad8-60953ad8", name: "Sambo" },
          { id: "AO-210b5c8e-60953ad8-1df2e19c", name: "Samboto" },
        ],
      },
      {
        id: "AO-210b5c8e-5128f683",
        name: "Galanga",
        communes: [
          { id: "AO-210b5c8e-5128f683-5128f683", name: "Galanga" },
          { id: "AO-210b5c8e-5128f683-ea81bf1f", name: "Cumbira" },
        ],
      },
      { id: "AO-210b5c8e-227fd8b7", name: "Alto Hama", communes: [] },
      { id: "AO-210b5c8e-0b24e331", name: "Chilata", communes: [] },
      {
        id: "AO-210b5c8e-987b1248",
        name: "Cuima",
        communes: [
          { id: "AO-210b5c8e-987b1248-987b1248", name: "Cuima" },
          { id: "AO-210b5c8e-987b1248-08219661", name: "Catata" },
        ],
      },
    ],
  },
  {
    id: "AO-8283bfa1",
    name: "Benguela",
    municipalities: [
      { id: "AO-8283bfa1-8283bfa1", name: "Benguela", communes: [] },
      { id: "AO-8283bfa1-80eb30c5", name: "Ganda", communes: [] },
      { id: "AO-8283bfa1-f1376f6b", name: "Lobito", communes: [] },
      { id: "AO-8283bfa1-4377a06e", name: "Catumbela", communes: [] },
      {
        id: "AO-8283bfa1-e90ca912",
        name: "Bocoio",
        communes: [
          { id: "AO-8283bfa1-e90ca912-e90ca912", name: "Bocoio" },
          { id: "AO-8283bfa1-e90ca912-b44c1ab3", name: "Cubal do Lumbo" },
          { id: "AO-8283bfa1-e90ca912-66286d0a", name: "Monte Belo" },
        ],
      },
      {
        id: "AO-8283bfa1-e7f51c84",
        name: "Balombo",
        communes: [
          { id: "AO-8283bfa1-e7f51c84-e7f51c84", name: "Balombo" },
          { id: "AO-8283bfa1-e7f51c84-a2de52c0", name: "Maca Mombolo" },
        ],
      },
      { id: "AO-8283bfa1-32c27575", name: "Cubal", communes: [] },
      { id: "AO-8283bfa1-19474b8c", name: "Baía Farta", communes: [] },
      {
        id: "AO-8283bfa1-3700f445",
        name: "Caimbambo",
        communes: [
          { id: "AO-8283bfa1-3700f445-3700f445", name: "Caimbambo" },
          { id: "AO-8283bfa1-3700f445-e4ff6fb5", name: "Caiave" },
          { id: "AO-8283bfa1-3700f445-1c486906", name: "Viangombe" },
        ],
      },
      {
        id: "AO-8283bfa1-d194f2f7",
        name: "Chongorói",
        communes: [
          { id: "AO-8283bfa1-d194f2f7-d194f2f7", name: "Chongorói" },
          { id: "AO-8283bfa1-d194f2f7-bfc815d0", name: "Camuine" },
        ],
      },
      {
        id: "AO-8283bfa1-73cfad48",
        name: "Egito Praia",
        communes: [
          { id: "AO-8283bfa1-73cfad48-73cfad48", name: "Egito Praia" },
          { id: "AO-8283bfa1-73cfad48-e98a71f2", name: "Canjala" },
        ],
      },
      { id: "AO-8283bfa1-bfe8d0bf", name: "Chindumbo", communes: [] },
      { id: "AO-8283bfa1-bc342562", name: "Dombe Grande", communes: [] },
      { id: "AO-8283bfa1-8eddc7ad", name: "Capupa", communes: [] },
      { id: "AO-8283bfa1-1ba541de", name: "Biópio", communes: [] },
      { id: "AO-8283bfa1-d626cf61", name: "Chila", communes: [] },
      { id: "AO-8283bfa1-86f9e069", name: "Chicuma", communes: [] },
      { id: "AO-8283bfa1-e43cdfea", name: "Babaera", communes: [] },
      { id: "AO-8283bfa1-18fb803b", name: "Iambala", communes: [] },
      { id: "AO-8283bfa1-30880a7f", name: "Catengue", communes: [] },
      { id: "AO-8283bfa1-32bdf6cf", name: "Bolonguera", communes: [] },
      { id: "AO-8283bfa1-c4f87371", name: "Canhamela", communes: [] },
      { id: "AO-8283bfa1-275524ca", name: "Navegantes", communes: [] },
    ],
  },
  {
    id: "AO-d1957ac5",
    name: "Namibe",
    municipalities: [
      { id: "AO-d1957ac5-21a7a3f9", name: "Moçâmedes", communes: [] },
      { id: "AO-d1957ac5-eca82b88", name: "Tômbwa", communes: [] },
      {
        id: "AO-d1957ac5-5f1f9a28",
        name: "Bibala",
        communes: [
          { id: "AO-d1957ac5-5f1f9a28-5f1f9a28", name: "Bibala" },
          { id: "AO-d1957ac5-5f1f9a28-0a4540fc", name: "Capangombe" },
          { id: "AO-d1957ac5-5f1f9a28-1fbe264e", name: "Caitou" },
          { id: "AO-d1957ac5-5f1f9a28-bf580931", name: "Lola" },
        ],
      },
      {
        id: "AO-d1957ac5-2821f5b6",
        name: "Virei",
        communes: [
          { id: "AO-d1957ac5-2821f5b6-2821f5b6", name: "Virei" },
          { id: "AO-d1957ac5-2821f5b6-8277319d", name: "Cainde" },
        ],
      },
      {
        id: "AO-d1957ac5-c7d790c5",
        name: "Camucuio",
        communes: [
          { id: "AO-d1957ac5-c7d790c5-c7d790c5", name: "Camucuio" },
          { id: "AO-d1957ac5-c7d790c5-5e542600", name: "Mamué" },
          { id: "AO-d1957ac5-c7d790c5-272bb998", name: "Chingo" },
        ],
      },
      {
        id: "AO-d1957ac5-10ec57a0",
        name: "Lucira",
        communes: [
          { id: "AO-d1957ac5-10ec57a0-10ec57a0", name: "Lucira" },
          { id: "AO-d1957ac5-10ec57a0-c3469cc9", name: "Bentiaba" },
        ],
      },
      { id: "AO-d1957ac5-a450e529", name: "Iona", communes: [] },
      { id: "AO-d1957ac5-d676fe62", name: "Sacomar", communes: [] },
      { id: "AO-d1957ac5-060b0d91", name: "Cacimbas", communes: [] },
    ],
  },
  {
    id: "AO-7e26d33b",
    name: "Huíla",
    municipalities: [
      {
        id: "AO-7e26d33b-19870d8c",
        name: "Caconda",
        communes: [
          { id: "AO-7e26d33b-19870d8c-19870d8c", name: "Caconda" },
          { id: "AO-7e26d33b-19870d8c-1c9b2d25", name: "Gungue" },
          { id: "AO-7e26d33b-19870d8c-7a9b045c", name: "Uaba" },
          { id: "AO-7e26d33b-19870d8c-4600e908", name: "Cusse" },
        ],
      },
      {
        id: "AO-7e26d33b-21fd6a8d",
        name: "Gambos",
        communes: [
          { id: "AO-7e26d33b-21fd6a8d-999969e3", name: "Chiange" },
          { id: "AO-7e26d33b-21fd6a8d-ba5b6f60", name: "Chimbemba" },
        ],
      },
      { id: "AO-7e26d33b-7554c070", name: "Humpata", communes: [] },
      {
        id: "AO-7e26d33b-1a728063",
        name: "Lubango",
        communes: [
          { id: "AO-7e26d33b-1a728063-1a728063", name: "Lubango" },
          { id: "AO-7e26d33b-1a728063-7e26d33b", name: "Huíla" },
        ],
      },
      { id: "AO-7e26d33b-81c651c4", name: "Cuvango", communes: [] },
      { id: "AO-7e26d33b-00853632", name: "Quipungo", communes: [] },
      {
        id: "AO-7e26d33b-b5bc6bb5",
        name: "Chibia",
        communes: [
          { id: "AO-7e26d33b-b5bc6bb5-b5bc6bb5", name: "Chibia" },
          { id: "AO-7e26d33b-b5bc6bb5-4787d0cd", name: "Jau" },
        ],
      },
      {
        id: "AO-7e26d33b-6a30c675",
        name: "Quilengues",
        communes: [
          { id: "AO-7e26d33b-6a30c675-6a30c675", name: "Quilengues" },
          { id: "AO-7e26d33b-6a30c675-2e1313da", name: "Impulo" },
          { id: "AO-7e26d33b-6a30c675-608c176b", name: "Dinde" },
        ],
      },
      {
        id: "AO-7e26d33b-dc91ad2b",
        name: "Caluquembe",
        communes: [
          { id: "AO-7e26d33b-dc91ad2b-dc91ad2b", name: "Caluquembe" },
          { id: "AO-7e26d33b-dc91ad2b-3865d105", name: "Calepi" },
          { id: "AO-7e26d33b-dc91ad2b-fc3c971b", name: "Negola" },
        ],
      },
      { id: "AO-7e26d33b-b70caa3d", name: "Matala", communes: [] },
      {
        id: "AO-7e26d33b-e3746f83",
        name: "Jamba Mineira",
        communes: [
          { id: "AO-7e26d33b-e3746f83-e3746f83", name: "Jamba Mineira" },
          { id: "AO-7e26d33b-e3746f83-dc1c23aa", name: "Cassinga" },
        ],
      },
      {
        id: "AO-7e26d33b-677a63f3",
        name: "Chipindo",
        communes: [
          { id: "AO-7e26d33b-677a63f3-677a63f3", name: "Chipindo" },
          { id: "AO-7e26d33b-677a63f3-46692eca", name: "Bambi" },
        ],
      },
      {
        id: "AO-7e26d33b-62a3fde4",
        name: "Chicomba",
        communes: [
          { id: "AO-7e26d33b-62a3fde4-62a3fde4", name: "Chicomba" },
          { id: "AO-7e26d33b-62a3fde4-9ed73ad7", name: "Cutenda" },
        ],
      },
      {
        id: "AO-7e26d33b-f8862b71",
        name: "Cacula",
        communes: [
          { id: "AO-7e26d33b-f8862b71-f8862b71", name: "Cacula" },
          { id: "AO-7e26d33b-f8862b71-ca1b77d7", name: "Tchicuaqueia" },
        ],
      },
      { id: "AO-7e26d33b-e5605fb5", name: "Dongo", communes: [] },
      { id: "AO-7e26d33b-5024d913", name: "Hoque", communes: [] },
      {
        id: "AO-7e26d33b-cd188494",
        name: "Capelongo",
        communes: [
          { id: "AO-7e26d33b-cd188494-cd188494", name: "Capelongo" },
          { id: "AO-7e26d33b-cd188494-4d1e46e3", name: "Mulondo" },
        ],
      },
      { id: "AO-7e26d33b-70b12840", name: "Chituto", communes: [] },
      {
        id: "AO-7e26d33b-2e58c406",
        name: "Capunda Cavilongo",
        communes: [
          { id: "AO-7e26d33b-2e58c406-2e58c406", name: "Capunda Cavilongo" },
          { id: "AO-7e26d33b-2e58c406-b4db4ca8", name: "Quihita" },
        ],
      },
      { id: "AO-7e26d33b-21777a9b", name: "Viti Vivali", communes: [] },
      { id: "AO-7e26d33b-0ff23bec", name: "Galangue", communes: [] },
      { id: "AO-7e26d33b-5bea5d55", name: "Palanca", communes: [] },
      { id: "AO-7e26d33b-802e944f", name: "Chicungo", communes: [] },
    ],
  },
  {
    id: "AO-946a6eb9",
    name: "Cunene",
    municipalities: [
      {
        id: "AO-946a6eb9-74187284",
        name: "Ombadja",
        communes: [
          { id: "AO-946a6eb9-74187284-2f56a2cb", name: "Xangongo" },
          { id: "AO-946a6eb9-74187284-a75e1182", name: "Ombala yo Mungu" },
        ],
      },
      {
        id: "AO-946a6eb9-4f95fdf3",
        name: "Cuanhama",
        communes: [
          { id: "AO-946a6eb9-4f95fdf3-26041c88", name: "Ondjiva" },
          { id: "AO-946a6eb9-4f95fdf3-ae7f20a3", name: "Môngua" },
        ],
      },
      { id: "AO-946a6eb9-09827f5e", name: "Curoca", communes: [] },
      {
        id: "AO-946a6eb9-dc5bfa2d",
        name: "Cahama",
        communes: [
          { id: "AO-946a6eb9-dc5bfa2d-dc5bfa2d", name: "Cahama" },
          { id: "AO-946a6eb9-dc5bfa2d-854bd86a", name: "Otchinjau" },
        ],
      },
      { id: "AO-946a6eb9-41bcbf47", name: "Cuvelai", communes: [] },
      { id: "AO-946a6eb9-a7d91af8", name: "Namacunde", communes: [] },
      { id: "AO-946a6eb9-c1116139", name: "Chiéde", communes: [] },
      {
        id: "AO-946a6eb9-cf20e12c",
        name: "Nehone",
        communes: [
          { id: "AO-946a6eb9-cf20e12c-cf20e12c", name: "Nehone" },
          { id: "AO-946a6eb9-cf20e12c-edaee188", name: "Evale" },
        ],
      },
      {
        id: "AO-946a6eb9-b01c4009",
        name: "Humbe",
        communes: [
          { id: "AO-946a6eb9-b01c4009-28b4b9fd", name: "Mucope" },
          { id: "AO-946a6eb9-b01c4009-b01c4009", name: "Humbe" },
        ],
      },
      { id: "AO-946a6eb9-edef053a", name: "Mupa", communes: [] },
      { id: "AO-946a6eb9-26a124a4", name: "Naulila", communes: [] },
      { id: "AO-946a6eb9-21164d65", name: "Chitado", communes: [] },
      { id: "AO-946a6eb9-39d2f7a3", name: "Cafima", communes: [] },
      { id: "AO-946a6eb9-a7169f67", name: "Chissuata", communes: [] },
    ],
  },
  {
    id: "AO-ff375ceb",
    name: "Cubango",
    municipalities: [
      { id: "AO-ff375ceb-36f575be", name: "Menongue", communes: [] },
      { id: "AO-ff375ceb-923cc4ee", name: "Cuchi", communes: [] },
      { id: "AO-ff375ceb-aed31083", name: "Calai", communes: [] },
      {
        id: "AO-ff375ceb-eb90046c",
        name: "Nancova",
        communes: [
          { id: "AO-ff375ceb-eb90046c-eb90046c", name: "Nancova" },
          { id: "AO-ff375ceb-eb90046c-18ae76bf", name: "Rito" },
        ],
      },
      { id: "AO-ff375ceb-922923b0", name: "Cuangar", communes: [] },
      {
        id: "AO-ff375ceb-3d02a440",
        name: "Savate",
        communes: [
          { id: "AO-ff375ceb-3d02a440-3d02a440", name: "Savate" },
          { id: "AO-ff375ceb-3d02a440-14c49bb1", name: "Bondo Caíla" },
        ],
      },
      {
        id: "AO-ff375ceb-fe38a1da",
        name: "Caiundo",
        communes: [
          { id: "AO-ff375ceb-fe38a1da-fe38a1da", name: "Caiundo" },
          { id: "AO-ff375ceb-fe38a1da-585a7c8f", name: "Jamba Cueio" },
        ],
      },
      {
        id: "AO-ff375ceb-2a088649",
        name: "Longa",
        communes: [
          { id: "AO-ff375ceb-2a088649-2a088649", name: "Longa" },
          { id: "AO-ff375ceb-2a088649-cec4e66f", name: "Baixo Longa" },
        ],
      },
      {
        id: "AO-ff375ceb-1fa1949a",
        name: "Cutato",
        communes: [
          { id: "AO-ff375ceb-1fa1949a-1fa1949a", name: "Cutato" },
          { id: "AO-ff375ceb-1fa1949a-f7feaadc", name: "Vissati" },
        ],
      },
      { id: "AO-ff375ceb-d57e14e9", name: "Chinguanja", communes: [] },
      {
        id: "AO-ff375ceb-e327019f",
        name: "Mavengue",
        communes: [
          { id: "AO-ff375ceb-e327019f-e327019f", name: "Mavengue" },
          { id: "AO-ff375ceb-e327019f-b2f12910", name: "Maué" },
        ],
      },
    ],
  },
  {
    id: "AO-8cfaa940",
    name: "Cuando",
    municipalities: [
      {
        id: "AO-8cfaa940-4d52e524",
        name: "Cuito Cuanavale",
        communes: [
          { id: "AO-8cfaa940-4d52e524-4d52e524", name: "Cuito Cuanavale" },
          { id: "AO-8cfaa940-4d52e524-163719e5", name: "Lupire" },
        ],
      },
      {
        id: "AO-8cfaa940-dca9de78",
        name: "Dirico",
        communes: [
          { id: "AO-8cfaa940-dca9de78-dca9de78", name: "Dirico" },
          { id: "AO-8cfaa940-dca9de78-17344ab5", name: "Xamavera" },
        ],
      },
      { id: "AO-8cfaa940-f587b25d", name: "Mavinga", communes: [] },
      { id: "AO-8cfaa940-3d2fe105", name: "Rivungo", communes: [] },
      { id: "AO-8cfaa940-5840fe87", name: "Xipundo", communes: [] },
      {
        id: "AO-8cfaa940-04d84367",
        name: "Dima",
        communes: [
          { id: "AO-8cfaa940-04d84367-829a2ca3", name: "Cunjamba" },
          { id: "AO-8cfaa940-04d84367-98fadffa", name: "Cutuile" },
        ],
      },
      { id: "AO-8cfaa940-0d56562e", name: "Luiana", communes: [] },
      { id: "AO-8cfaa940-6deab2b4", name: "Mucusso", communes: [] },
      { id: "AO-8cfaa940-f2538e86", name: "Luengue", communes: [] },
    ],
  },
];
