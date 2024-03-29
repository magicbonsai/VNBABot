# example/ex-sync.R
needs(magrittr)
needs(data.table)
needs(googlesheets4)
needs(stringr)
needs(tidyr)
needs(jsonlite)
needs(neighbr)
# gs4_auth(
#   path = googleCreds,
#   scopes = "https://www.googleapis.com/auth/spreadsheets.readonly"
# )
gs4_deauth()
attach(input[[1]])
# Get player from sheet
getPlayer = function(name) {
  nameSplit = str_split(name, " ")[[1]]
  if (name == "Zhi Zhi Yi") {
    nameSplit = c("Zhi Zhi", "Yi")
  }
  return(paste0(str_to_upper(substring(nameSplit[1], 1, 1)), ". ", paste0(nameSplit[2:length(nameSplit)], collapse = " "), collapse = ""))
}

# Convert height to inches
heightToInches = function(height) {
  heightSplit = str_split(height, "\'")[[1]]
  return(as.numeric(heightSplit[1]) * 12 + as.numeric(str_replace(heightSplit[2], "\"", "")))
}

# Get cash value of pick
pickToCash = function(picks, assetValueParams) {
  return(exp(picks * (assetValueParams$draftAlpha) + (assetValueParams$draftBeta)) * assetValueParams$cashRatio)
}

# Get category values
getCategoryValues = function(categoryUrl, sheetNum) {
  return(data.table(read_sheet(categoryUrl, 
                                         paste("bot test sheet", sheetNum), 
                                         col_names = TRUE)))
}

# Get asset values
getAssetValues = function(assetUrl) {
  output = data.table(read_sheet(assetUrl, 
                               "Team Assets", 
                               col_names = TRUE))
  output = setNames(output, str_replace_all(names(output), " ", "_"))
  return(output[, .(Team, Frozen, Cash, Cash_Next_Season, Draft_Picks, Record, Real)])
}


# Get player list
getPlayerList = function(listUrl) {
  playerList = data.table(read_sheet(listUrl, 
                                     "Player List", 
                                     col_names = TRUE))
  playerList[, Player := unlist(lapply(Name, getPlayer))]
  playerList = setNames(playerList, str_replace_all(names(playerList), " ", "_"))
  return(playerList)
}

# Get player stats from past 2 + current seasons
getPlayerStats = function(statsUrl, statsUrlOld, statsUrlOldOld, playerList, teamAssets, minThreshold = 8) {
  playerStats = data.table(read_sheet(statsUrl, 
                                      "League Leaders", 
                                      col_names = TRUE,
                                      na = c("", "NA", "N/A", "#N/A", "#VALUE!", "#DIV/0!")))
  playerStats = setNames(playerStats, str_replace_all(names(playerStats), " ", "_"))
  playerStats = playerStats[3:.N, ]
  playerStats = playerStats[!is.na(Player)]
  playerStats[, 3:ncol(playerStats)] = lapply(playerStats[, 3:ncol(playerStats)], function(x){as.numeric(as.character(x))})

  playerStatsOld = data.table(read_sheet(statsUrlOld, 
                                         "League Leaders", 
                                         col_names = TRUE,
                                         na = c("", "NA", "N/A", "#N/A", "#VALUE!", "#DIV/0!")))
  playerStatsOld = setNames(playerStatsOld, str_replace_all(names(playerStatsOld), " ", "_"))
  playerStatsOld = playerStatsOld[3:.N, ]
  playerStatsOld = playerStatsOld[!is.na(Player)]
  playerStatsOld[, 3:ncol(playerStatsOld)] = lapply(playerStatsOld[, 3:ncol(playerStatsOld)], function(x){as.numeric(as.character(x))})
  
  playerStatsOldOld = data.table(read_sheet(statsUrlOldOld, 
                                         "League Leaders", 
                                         col_names = TRUE,
                                         na = c("", "NA", "N/A", "#N/A", "#VALUE!", "#DIV/0!")))
  playerStatsOldOld = setNames(playerStatsOldOld, str_replace_all(names(playerStatsOldOld), " ", "_"))
  playerStatsOldOld = playerStatsOldOld[3:.N, ]
  playerStatsOldOld = playerStatsOldOld[!is.na(Player)]
  playerStatsOldOld[, 3:ncol(playerStatsOldOld)] = lapply(playerStatsOldOld[, 3:ncol(playerStatsOldOld)], function(x){as.numeric(as.character(x))})
  
  playerStatsFull = merge(playerList[, .(Player, Name, Current_Team = Team, Overall, Position, Height, Weight, Contract_Length, Age, Salary, Type)], 
                          rbindlist(list(playerStats[, Season := "Current"], playerStatsOld[, Season := "Last"], playerStatsOldOld[, Season := "Last_2"]), use.names=TRUE, fill=TRUE), 
                          by = "Player",
                          all.x = TRUE)
  playerStatsFull[, Height := unlist(lapply(Height, heightToInches))]
  playerStatsFull[, Salary := as.numeric(str_extract_all(Salary, "[0-9]+"))]
  playerStatsFull = data.table(unnest(playerStatsFull, cols = names(playerStatsFull)))
  playerStatsFull = playerStatsFull[Minutes >= minThreshold]
  playerStatsFull = playerStatsFull[Games_Played >= 3]
  playerStatsFull = playerStatsFull[Games_Played * Minutes >= 50]
  playerStatsFull = playerStatsFull[Team %in% toupper(teamAssets[Real == TRUE]$Team)]
  playerStatsFull[, Overall := Overall + (Position == "PG" | Position == "C") * 3 + (Position == "SG") * 2]
  
  return(playerStatsFull)
}

# Normalize Player Stats
normalizeStats = function(playerStats, categoryValues, corThreshold = 0.8) {
  
  normalizedStats = playerStats[, names(playerStats)[names(playerStats) %in% categoryValues[!is.na(Include)]$Feature], with = FALSE]
  
  cols = categoryValues[!is.na(Include) & !is.na(Team_Normalize)]$Feature
  normalizedStats[, (cols) := lapply(.SD, function(x) as.vector(scale(x))), .SDcols = cols,  by = "Team"]
  
  cols = categoryValues[!is.na(Include) & !is.na(Position_Normalize)]$Feature
  normalizedStats[, (cols) := lapply(.SD, function(x) as.vector(scale(x))), .SDcols = cols,  by = "Type"]
  
  cols = categoryValues[!is.na(Include) & Include != "As Cat" & is.na(Position_Normalize) & is.na(Team_Normalize)]$Feature
  normalizedStats[, (cols) := lapply(.SD, function(x) as.vector(scale(x))), .SDcols = cols]
  
  normalizedStats[is.na(normalizedStats)] = 0
  normalizedStats = normalizedStats[, c("Player", "Name", "Type", "Team") := NULL]

  normalizedStats = normalizedStats[, sample(1:ncol(normalizedStats)), with = FALSE]
  
  statsCor = cor(normalizedStats)
  statsCor[upper.tri(statsCor)] = 0
  diag(statsCor) = 0
  colNames = data.table(Feature = colnames(statsCor[, !apply(statsCor, 2, function(x) any(x > corThreshold, na.rm = TRUE))]))
  normalizedStats = normalizedStats[, colNames$Feature, with = FALSE]
  
  return(normalizedStats)
}

# Grab parameters given valuation stats
getParameters = function(categoryValues, normalizedStats) {
  parameters = merge(data.table(Feature = colnames(normalizedStats), Order = 1:length(colnames(normalizedStats))), categoryValues[, .(Feature, Feature_Weight)], by = "Feature")
  parameters[, Final_Weight := (runif(.N, 0.5, 2) * Feature_Weight) + (runif(.N, -0.5, 0.5) * Feature_Weight)]
  parameters = parameters[order(Order)]
  parameters[, Order := NULL]
  return(parameters)
}

# Get player stat scores
getPlayerStatScores  = function(playerStats, normalizedStats, parameters) {
  
  scores = playerStats[, .(Player, Name, Current_Team, Team, Type, Position, Overall, Games_Played, Season, Score = as.vector(as.matrix(normalizedStats) %*% parameters$Final_Weight))]
  scores = scores[, .(Name = first(Name), 
                    Team = paste0(unique(Team), collapse = ", "), 
                    Position = first(Position),
                    Type = first(Type),
                    Current_Team = first(Current_Team),
                    Overall = first(Overall), 
                    Score = weighted.mean(Score, Games_Played * ifelse(Season == "Last_2", 0.4, ifelse(Season == "Last", 0.6, 1))) + abs(min(scores$Score)) + 1),
                by = "Player"]
  return(scores)
}

# Get cash value
getAssetValueParam = function(playerScores, playerList) {
  
  # Get cash value 
  data = merge(playerScores, playerList[, .(Player, Salary, Draft_Position)], by = "Player")
  cashRatio = sum(data$Salary, na.rm = TRUE) / sum(data[!is.na(Salary)]$Score)
  
  # Get simple draft pick model
  fit = lm(log(data$Score) ~ data$Draft_Position)
  draftBeta = fit$coefficients[[1]]
  draftAlpha = fit$coefficients[[2]]
  
  return(list(cashRatio = cashRatio, draftBeta = draftBeta, draftAlpha = draftAlpha))
}

# Get player stat scores with cash
getAssetStatValues  = function(categoryValues, playerScores, teamAssets, assetValueParams) {
  
  positionWeights = categoryValues[!is.na(Position), .(Position, Position_Weight)]
  assetWeights = categoryValues[!is.na(Asset), .(Asset, Asset_Weight)]
  
  # Get player assets
  playerAssets = playerScores[, .(Name, Type, Team = Current_Team, Cash_Value = Score * assetValueParams$cashRatio)]
  
  for (pos in positionWeights$Position) {
    playerAssets[Type == pos, Weighted_Value := positionWeights[Position == pos]$Position_Weight[1] * Cash_Value * assetWeights[Asset == "Player"]$Asset_Weight[1]]
  }
    
  # Get draft assets
  draftAssets  = 
    rbindlist(lapply(1:nrow(teamAssets), function(i) {
    temp = data.table(Team = teamAssets[i]$Team, Frozen = teamAssets[i]$Frozen, Pick_Full = str_trim(unlist(str_split(teamAssets[i]$Draft_Picks, ","))))
    temp[, Pick := str_extract(Pick_Full, "1|2")]
    temp[, Pick_Team := str_extract(Pick_Full, "[:alpha:]+")]
    return(temp)
    }), fill = TRUE)
  
  if (assetWeights[Asset == "Season_End"]$Asset_Weight == 1) {
    draftAssets = merge(draftAssets, categoryValues[!is.na(Pick_Full), .(Pick_Full, Pick_Position = as.numeric(Pick_Position))], by = "Pick_Full")
  } else {
    pickPositions = 
      teamAssets[, Win_Perc := sapply(Record, function(x) {
        as.numeric(str_split(x, " ")[[1]][1]) / (as.numeric(str_split(x, " ")[[1]][3]) + as.numeric(str_split(x, " ")[[1]][1]))
      })][Frozen == FALSE][order(Win_Perc)]
    pickPositions[, Pick_Position := rank(Win_Perc)]
    pickPositions = rbindlist(list(copy(pickPositions)[, Pick := 1], pickPositions[, Pick := 2]), fill = TRUE)
    pickPositions[, Pick_Position := ifelse(Pick == 2, Pick_Position + nrow(teamAssets[Frozen == FALSE]), Pick_Position)]
    draftAssets = merge(draftAssets, pickPositions[, .(Pick_Team = Team, Pick = as.character(Pick), Pick_Position)], by = c("Pick_Team", "Pick"))
  }
  
  draftAssets = draftAssets[, .(Name = Pick_Full, Team = Team, Cash_Value = pickToCash(Pick_Position, assetValueParams))]
  draftAssets[, Weighted_Value := ifelse(str_detect(Name, "1"), assetWeights[Asset == "FRP"]$Asset_Weight, assetWeights[Asset == "SRP"]$Asset_Weight) * Cash_Value]

  return(rbindlist(list(playerAssets, draftAssets), use.names = TRUE, fill = TRUE))
}

# Trade Finder
tradeFinder = function(assetValues, assetsToTrade, sourceTeam, destTeams, categoryValues, winBy = 5, winMax = 10, cashCap = 33, maxIters = 100) {
  
  tradePackageOut = assetValues[Name %in% assetsToTrade]
  tradePackageValueOut = sum(tradePackageOut$Weighted_Value)
  
  destTeam = sample(destTeams[destTeams != sourceTeam], 1)
  assetsToGet = assetValues[Team == destTeam][, .(Name)][sample(.N, floor(runif(1, 1, 4)))]$Name
  tradePackageIn = assetValues[Name %in% assetsToGet]
  tradePackageValueIn = sum(tradePackageIn$Weighted_Value)
  
  invalid = TRUE
  numIters = 0
  
  while (invalid == TRUE & numIters < maxIters) {
    
    if (tradePackageValueOut + winMax < tradePackageValueIn) {
      # Add cash out
      tradeIn = tradePackageIn
      tradeOut = rbind(tradePackageOut, data.table(Name = "Cash", 
                                                  Type = as.character(NA), 
                                                  Team = sourceTeam, 
                                                  Cash_Value = (tradePackageValueIn - winMax - tradePackageValueOut) / categoryValues[Asset == "Cash"]$Asset_Weight,  
                                                  Weighted_Value = tradePackageValueIn - winMax - tradePackageValueOut))
      
      invalid = ((tradePackageValueIn - winMax - tradePackageValueOut) / categoryValues[Asset == "Cash"]$Asset_Weight) > cashCap
      
    } else if (tradePackageValueOut + winBy > tradePackageValueIn) {
      # Add cash in
      tradeIn = rbind(tradePackageIn, data.table(Name = "Cash", 
                                                 Type = as.character(NA), 
                                                 Team = destTeam, 
                                                 Cash_Value = (winBy + tradePackageValueOut - tradePackageValueIn) / categoryValues[Asset == "Cash"]$Asset_Weight,  
                                                 Weighted_Value = winBy + tradePackageValueOut - tradePackageValueIn))
      tradeOut = tradePackageOut
      
      invalid = ((winBy + tradePackageValueOut - tradePackageValueIn) / categoryValues[Asset == "Cash"]$Asset_Weight) > cashCap
      
    } else {
      # Add no cash
      tradeIn = tradePackageIn
      tradeOut = tradePackageOut
      
      invalid = FALSE
    }
    
    destTeam = sample(destTeams[destTeams != sourceTeam], 1)
    assetsToGet = assetValues[Team == destTeam][, .(Name)][sample(.N, floor(runif(1, 1, 4)))]$Name
    tradePackageIn = assetValues[Name %in% assetsToGet]
    tradePackageValueIn = sum(tradePackageIn$Weighted_Value)
    
    numIters = numIters + 1
    
  }
  return(list(tradeOut = tradeOut, tradeIn = tradeIn))
}

# Get Random Trade
randomTrade = function(assetValues, sourceTeams, destTeams, categoryValues, winBy = 5, winMax = 10) {
  sourceTeam = sample(sourceTeams, 1)
  assetsToGive = assetValues[Team == sourceTeam][, .(Name)][sample(.N, floor(runif(1, 1, 4)))]$Name
  return(
    tradeFinder(assetValues, assetsToGive, sourceTeam, destTeams, categoryValues, winBy, winMax)
  )
}

# Evaluate Trade
evaluateTrade = function(assetValues, assetsToTrade, assetsToGet, categoryValues, winBy = 5, winMax = 10) {
  
  tradePackageOut = assetValues[Name %in% assetsToTrade]
  tradePackageValueOut = sum(tradePackageOut$Weighted_Value)
  tradeOut = tradePackageOut
  
  tradePackageIn = assetValues[Name %in% assetsToGet]
  tradePackageValueIn = sum(tradePackageIn$Weighted_Value)
  tradeIn = tradePackageIn
  
  return(list(Team1 = tradeOut, tradePackageValueOut = tradePackageValueOut, Team2 = tradeIn, tradeInValue = tradePackageValueIn, 
              winner = ifelse(tradePackageValueOut > tradePackageValueIn, "Team 1", "Team 2")))
}

# Get player attributes
getPlayerAttributes = function(playerList) {
  playerAttributes = data.table()
  for (i in 1:nrow(playerList)) {
    if (!is.na(playerList[i]$Data)) {
      lst = fromJSON(playerList[i]$Data, flatten = FALSE, simplifyVector = FALSE)
      attrib = as.data.table(lst[[4]][["data"]])
      attrib = attrib[, names(attrib)[!str_detect(names(attrib), "DURABILITY|POTENTIAL|EMOTION|PICK_AND_ROLL|SHOT_CONTEST")], with = FALSE]
      badges = as.data.table(lst[[9]][["data"]])
      badges = badges[, names(badges)[!str_detect(names(badges), "RESERVED|FRIENDLY|WORK_ETHIC|KEEP_IT_REAL|PAT_MY_BACK|EXPRESSIVE|UNPREDICTAVLE|LAID_BACK|RINGMASTER|WARM_WEATHER|FINANCE|CAREER_GYM|ON_COURT_COACH")], with = FALSE]
      vitals = as.data.table((lst[[1]][["data"]]))[, .(HEIGHT_CM, WEIGHT_LBS, WINGSPAN_CM)]
      temp = 
        cbind(data.table(Name = playerList[i]$Name, 
                         Team = playerList[i]$Team,
                         Type = playerList[i]$Type,
                         Position = playerList[i]$Position,
                         Overall = playerList[i]$Overall), 
              vitals, 
              attrib, 
              badges)
      playerAttributes = rbind(playerAttributes, temp)
    }
  }
  return(playerAttributes)
}

# Get player comps
getPlayerComparisons = function(assetValues, playerAttributes, categoryValues) {
  
  data = merge(playerAttributes, assetValues[, .(Name, Score = Weighted_Value)], by = "Name", all.x = TRUE)
  data[, Overall := Overall + (Position == "PG" | Position == "C") * 3 + (Position == "SG")]
  data[, Type := as.numeric(factor(Type, levels = c("G", "W", "B"), ordered = TRUE))]
  data[, Position := as.numeric(factor(Position, levels = c("PG", "SG", "SF", "PF", "C"), ordered = TRUE))]
  cols = colnames(data)[5:(ncol(data)-1)]
  data[, (cols) := lapply(.SD, function(x) as.vector(scale(as.numeric(x)))), .SDcols = cols, by = "Type"]
  data[, (cols) := lapply(.SD, as.numeric), .SDcols = cols]
  data[, Position := NULL]

  # Higher Weighting
  dataValues = data[, categoryValues$Attribute, with = FALSE]
  weightings = merge(data.table(Attribute = colnames(dataValues), Order = 1:length(colnames(dataValues))), categoryValues[, .(Attribute, Attribute_Weight)], by = "Attribute", all.x = TRUE)
  weightings = weightings[order(Order)]
  weightings[is.na(Attribute_Weight), Attribute_Weight := 0]
  weightings = diag(weightings$Attribute_Weight)
  dataNames = names(dataValues)
  dataValues = as.data.table(as.matrix(dataValues) %*% weightings)
  names(dataValues) = dataNames
  data = cbind(data[, names(data)[!(names(data) %in% names(dataValues))], with = FALSE], dataValues)     
  
  train = copy(data)[!is.na(Score)]
  test = copy(data)[is.na(Score) & Team == 'Rookie']
  if (nrow(test) < 1) {
    return(data.table())  
  }
  train[, Team := NULL]
  test[, Team := NULL]
  test[, Score := NULL]
  testNames = test$Name
  test[, Name := NULL]
             
  fit = 
    knn(train_set = train,
      test_set = test,
      k = 6,
      continuous_target = "Score",
      comparison_measure = "squared_euclidean",
      return_ranked_neighbors = 4,
      id = "Name")
  
  result = fit$test_set_scores
  result[, Player := testNames]
  
  return(result)
}

categoryValues1 = getCategoryValues("https://docs.google.com/spreadsheets/d/1INS-TKERe24QAyJCkhkhWBQK4eAWF8RVffhN1BZNRtA/edit?pli=1#gid=1367256051", 1)
categoryValues2 = getCategoryValues("https://docs.google.com/spreadsheets/d/1INS-TKERe24QAyJCkhkhWBQK4eAWF8RVffhN1BZNRtA/edit?pli=1#gid=1367256051", 2)
categoryValues3 = getCategoryValues("https://docs.google.com/spreadsheets/d/1INS-TKERe24QAyJCkhkhWBQK4eAWF8RVffhN1BZNRtA/edit?pli=1#gid=1367256051", 3)

teamAssets = getAssetValues("https://docs.google.com/spreadsheets/d/1INS-TKERe24QAyJCkhkhWBQK4eAWF8RVffhN1BZNRtA/edit?pli=1#gid=1367256051")

playerList = getPlayerList("https://docs.google.com/spreadsheets/d/1INS-TKERe24QAyJCkhkhWBQK4eAWF8RVffhN1BZNRtA/edit?pli=1#gid=1367256051")
playerStats = getPlayerStats("https://docs.google.com/spreadsheets/d/1INS-TKERe24QAyJCkhkhWBQK4eAWF8RVffhN1BZNRtA/edit?pli=1#gid=1367256051", 
                             "https://docs.google.com/spreadsheets/d/1noWjKTsgxAaTlK2gdSJmNcHSiySgGfTlRlLUgE8Q6k4/edit#gid=1367256051",
                             "https://docs.google.com/spreadsheets/d/1bpImNDVYWfJJ8DY4-36_onMhjVt_kt3GFLPWc_7EqsU/",
                             playerList,
                             teamAssets)
                          
playerAttributes = getPlayerAttributes(playerList)

# Bot 1                          
normalizedStats1 = normalizeStats(playerStats, categoryValues1)
parameters1 = getParameters(categoryValues1, normalizedStats1) 
playerScores1 = getPlayerStatScores(playerStats, normalizedStats1, parameters1)

assetValueParams1 = getAssetValueParam(playerScores1, playerList)
assetValues1 = getAssetStatValues(categoryValues1, playerScores1, teamAssets, assetValueParams1)
                          
# Bot 2
normalizedStats2 = normalizeStats(playerStats, categoryValues2)
parameters2 = getParameters(categoryValues2, normalizedStats2)
playerScores2 = getPlayerStatScores(playerStats, normalizedStats2, parameters2)

assetValueParams2 = getAssetValueParam(playerScores2, playerList)
assetValues2 = getAssetStatValues(categoryValues2, playerScores2, teamAssets, assetValueParams2)                         
                          
# Bot 3                          
normalizedStats3 = normalizeStats(playerStats, categoryValues3)
parameters3 = getParameters(categoryValues3, normalizedStats3)
playerScores3 = getPlayerStatScores(playerStats, normalizedStats3, parameters3)

assetValueParams3 = getAssetValueParam(playerScores3, playerList)
assetValues3 = getAssetStatValues(categoryValues3, playerScores3, teamAssets, assetValueParams3)

teams = c("Knicks", "Spurs", "Warriors", "Raptors", "Wizards", "Celtics", "Mavericks", "Jazz")

knnValues1 = getPlayerComparisons(assetValues1, playerAttributes, categoryValues1)
knnValues2 = getPlayerComparisons(assetValues2, playerAttributes, categoryValues2)
knnValues3 = getPlayerComparisons(assetValues2, playerAttributes, categoryValues3)


list(assetValues1, knnValues1, assetValues2, knnValues2, assetValues3, knnValues3)
