// CACTUS meta-library target lists (curated, verbatim from the CACTUS master list).
//
// These are the natural-gene / microRNA target sets that drive the
// overexpression, knockout and knockdown CACTUS sub-libraries. The
// protein-coding sub-libraries (full-length CARs, CAR binder/specificity
// domains, CAR signaling domains and synthetic genes) carry curated DNA
// sequences and are sourced from the knock-in library (see `cactus.ts`).
//
// Symbols are kept as written in the source list (including mouse-style
// casing and alias parentheticals). They are normalized and resolved to
// sequences at load time; nothing is fabricated here.

// "Gene- Knockdown/Out": each target is screened both as a knockout (gRNA)
// and as a knockdown (shRNA). The same symbol pool feeds both sub-libraries.
export const CACTUS_KNOCKDOWN_KNOCKOUT_TARGETS: string[] = [
  'CD5', 'PDCD1', 'Lag3', 'CTLA4', 'HAVCR2', 'TIGIT', 'VSIR', 'TGFBR1', 'TGFBR2', 'Fas',
  'TNFRSF10B', 'KLRB1', 'CCR7', 'TMEM184B', 'TMEM222', 'Slc7a1', 'Slc38a2', 'ITGA1', 'SELPLG', 'ADRB1',
  'ADRB2', 'EMP1', 'SUSD2', 'PTGER2', 'KIR3DL3', 'ADORA2A', 'CD36', 'LAYN', 'SIT1', 'LAIR1',
  'CEACAM1', 'CEACAM3', 'CEACAM5', 'CD244', 'TNFRSF14', 'FAT1', 'FAT3', 'KDR', 'CD59', 'ICAM1',
  'ENTPD1', 'NT5E', 'Ppp2r2d', 'Rasa2', 'Dpf2', 'LCK', 'PTPN1', 'PTPN2', 'SHP1', 'SHP2',
  'PTPN22', 'DUSP2', 'UBASH3A', 'UBASH3B', 'MTMR9', 'MTMR7', 'CABIN1', 'TBC1D10C', 'TRIB1', 'Dhx37',
  'MAO-A', 'CerS6', 'PIK3CG', 'PIK3CD', 'Sphk1', 'Sphk2', 'MAP4K1', 'MAP3K3', 'MAP4K4', 'MAPK14',
  'STK17B', 'DGKA', 'DGKZ', 'CSK', 'EIF2AK3', 'LYN', 'PRKAR1A', 'ITK', 'EIF2AK2', 'ARHGEF2',
  'ST3GAL1', 'Pofut1', 'SESN2', 'OTULINL', 'AGPS', 'SIRT2', 'AAK1', 'PDIA3', 'Mgat5', 'EHD2',
  'FIBP', 'SNX9', 'FUT8', 'SOCS1', 'SOCS2', 'SOCS3', 'CISH', 'Cul5', 'Ube2f', 'RNF19B',
  'RNF20', 'CBLB', 'RNF128', 'RNF41', 'Peli1', 'MDM2', 'DTX1', 'USP15', 'TNFAIP3', 'CYLD',
  'VHL', 'ACAT1', 'PLA2G4A', 'IDO1', 'ARG1', 'GLS', 'PRKAA1', 'PDPK1', 'BTG1', 'CDKN1B',
  'CDKN2A', 'CDKN2B', 'PHLDA1', 'ATM', 'HNRNPK', 'RB1', 'DNM2', 'FBXW7', 'PTEN', 'IDH2',
  'RHOA', 'CYC1', 'CMIP', 'TRAF6', 'CCNT1', 'BCL2L11', 'SMAD2', 'AKAP13', 'UBAP2L', 'PTBP1',
  'CARM1', 'SH2B3', 'LRCH1', 'PAG1', 'GRAP', 'ALX1', 'LAT2', 'CYRIB', 'Fdft1', 'ZC3H12A',
  'RC3H1', 'ZFP36', 'EIF4G2', 'EIF5A', 'FUBP1', 'IRF4', 'ID3', 'SOX4', 'FoxP1', 'Tob1',
  'PRDM1', 'Fli1', 'NR2F6', 'NR4A1', 'NR4A2', 'NR4A3', 'TOX', 'TOX2', 'TCF1', 'EGR2',
  'Bach2', 'BCL11B', 'HIVEP2', 'CBFB', 'MED12', 'CCNC', 'PPARG', 'BCOR', 'TLE4', 'IKZF1',
  'IKZF2', 'IKZF3', 'IKZF4', 'EOMES', 'BRD4', 'ELOB', 'NR1H2', 'NR1H4', 'Gata3', 'NR3C1',
  'RCOR1', 'BATF', 'AR', 'SATB1', 'Myc', 'BHLHE40', 'FOXO3', 'Tet2', 'Dnmt3a', 'SUV39H1',
  'KDM1A', 'ARID1A', 'ARID2', 'ARID4B', 'PBRm1', 'BRD7', 'Smarca4', 'Smarcc1', 'Smarcd3', 'Smarcd2',
  'SGF29', 'TADA1', 'TADA2B', 'TRRAP', 'FOS', 'ATF6', 'IRF2', 'ERG', 'VDR', 'Setd1b',
  'ZBTB7A', 'ZEB1', 'Foxo1', 'DDIT3', 'CTBP1',
]

// "Gene- Overexpression": natural-gene overexpression targets (CDS).
export const CACTUS_OVEREXPRESSION_TARGETS: string[] = [
  'IL2RA', 'IL7RA', 'c-fms (CSF-1 R)', 'LTBR', 'CCR2', 'CCR4', 'CCR6', 'CCR7', 'CCR8', 'CXCR1 (IL8R)',
  'CXCR2 (IL8R)', 'CXCR3', 'CXCR5', 'CXCR6', 'CX3CR1', 'CD28', '41BB (CD137)', 'OX40', 'KCNA3 (Kv1.3)', 'KCNN4',
  'Glut1', 'CD16', 'DNAM1 (CD226)', 'βII spectrin (SPTBN1)', 'DNM1L (DRP1)', 'NCAM1', 'Glut3', 'LAT1', 'CD59', 'EPCAM',
  'ADA', 'hTERT', 'CAT', 'PCK1', 'RHEB', 'Choline acetyltransferase (ChAT)', 'Argininosuccinate synthase (ASS)', 'Ornithine transcarbamylase (OTC)', 'VAV1', 'FSP1 (ferroptosis suppressor protein 1)',
  'GPX4 (glutathione peroxidase 4)', 'Lck', 'AMPK-γ', 'AKT', 'BRAF', 'IKBKG', 'MDM2', 'CCNB1IP1', 'PRODH2', 'CARD11',
  'PLCG1', 'PRKCQ', 'RLTPR', 'AHNAK', 'LDH', 'GOT2', 'PDSS2', 'FUT6', 'TCF1', 'TCF7L1',
  'TCF7L2', 'HMGB2', 'cJun', 'JunB', 'BATF', 'BATF3', 'FosL1', 'FosL2', 'Bach2', 'Myc',
  'TFAP4', 'Bcl6', 'ZNF683', 'KLF4', 'KLF2', 'FoxP1', 'FOXO1', 'STAT3', 'PPARGC1A', 'ETS1',
  'IRF4', 'IRF8', 'BAZ1B', 'PSIP1', 'TSN', 'BAG6', 'EZH2', 'SBNO2', 'Runx3', 'GSE1',
]

// "MicroRNA- Deletion" / "MicroRNA- Overexpression". The app does not bundle a
// curated sequence source for these microRNAs, so they are surfaced as
// placeholder targets to faithfully represent the CACTUS list.
export const CACTUS_MICRORNA_DELETION_TARGETS: string[] = [
  'miR-150', 'miR-146a', 'miR-155', 'miR-10a', 'miR-31',
]

export const CACTUS_MICRORNA_OVEREXPRESSION_TARGETS: string[] = [
  'miR-17-92', 'miR-155', 'miR-29a', 'miR-200c',
]
