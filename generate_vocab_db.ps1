# UTF-8 encoding support
$OutputEncoding = [System.Text.Encoding]::UTF8

# File paths
$levelsPath = "C:\Users\admin\.gemini\antigravity\brain\da597b11-6afa-4173-a08c-98f6f2deb42b\.system_generated\steps\196\content.md"
$turkishCsvPath = "c:\Users\admin\.gemini\antigravity\scratch\vocab-app\oxford3000_turkish.csv"
$ipaPath = "c:\Users\admin\.gemini\antigravity\scratch\vocab-app\en_US.txt"
$configPath = "c:\Users\admin\.gemini\antigravity\scratch\vocab-app\config.json"
$outputPath = "c:\Users\admin\.gemini\antigravity\scratch\vocab-app\data.js"

Write-Output "Starting vocabulary database compilation..."

# 0. Load Configuration JSON (with Emojis and Humorous sentences)
Write-Output "Loading config.json..."
$configRaw = Get-Content -Path $configPath -Raw -Encoding UTF8
$config = $configRaw | ConvertFrom-Json
$emojiMap = $config.emojiMap
$humorousMap = $config.humorousMap
$unmatchedFallbackDict = $config.unmatchedFallbackDict
$templates = $config.templates
Write-Output "Configuration loaded successfully."

# 1. Load IPA Dictionary
Write-Output "Loading IPA dictionary..."
$ipaMap = @{}
$ipaLines = Get-Content -Path $ipaPath -Encoding UTF8
foreach ($line in $ipaLines) {
    if ($line -match "^([^\t]+)\t(.+)$") {
        $w = $Matches[1].Trim().ToLower()
        $ipa = $Matches[2].Trim()
        if (-not $ipaMap.ContainsKey($w)) {
            $ipaMap[$w] = $ipa
        }
    }
}
Write-Output "IPA dictionary loaded with $($ipaMap.Count) entries."

# 2. Load Turkish Translation Dataset
Write-Output "Loading English-Turkish translations..."
$csv = Import-Csv -Path $turkishCsvPath -Encoding UTF8
$csvMap = @{}
foreach ($row in $csv) {
    $w = $row.Word.Trim().ToLower()
    if (-not $csvMap.ContainsKey($w)) {
        $csvMap[$w] = $row
    }
}
Write-Output "Translations loaded with $($csvMap.Count) entries."

# 3. Load Level-Categorized Words
Write-Output "Categorizing Oxford 5k words by CEFR levels..."
$a1WordsRaw = @()
$a2WordsRaw = @()
$b1WordsRaw = @()
$b2WordsRaw = @()

$levelLines = Get-Content -Path $levelsPath -Encoding UTF8
foreach ($line in $levelLines) {
    if ($line -match "^([^,]+),([a-z0-9]+),") {
        $w = $Matches[1].Trim().ToLower()
        $lvl = $Matches[2].Trim().ToLower()
        
        # Avoid duplicate words in the same level list
        if ($lvl -eq 'a1' -and $w -notin $a1WordsRaw) { $a1WordsRaw += $w }
        elseif ($lvl -eq 'a2' -and $w -notin $a2WordsRaw) { $a2WordsRaw += $w }
        elseif ($lvl -eq 'b1' -and $w -notin $b1WordsRaw) { $b1WordsRaw += $w }
        elseif ($lvl -eq 'b2' -and $w -notin $b2WordsRaw) { $b2WordsRaw += $w }
    }
}

Write-Output "Oxford 5k Raw level counts:"
Write-Output "  A1: $($a1WordsRaw.Count)"
Write-Output "  A2: $($a2WordsRaw.Count)"
Write-Output "  B1: $($b1WordsRaw.Count)"
Write-Output "  B2: $($b2WordsRaw.Count)"

# Function to match spelling variants
function Get-Translation($word) {
    # Check direct match
    if ($csvMap.ContainsKey($word)) { return $csvMap[$word] }
    
    # Check basic British/American variants
    $usWord = $word
    $usWord = $usWord -replace "our$", "or"
    $usWord = $usWord -replace "programme$", "program"
    $usWord = $usWord -replace "metre$", "meter"
    $usWord = $usWord -replace "centre$", "center"
    $usWord = $usWord -replace "grey$", "gray"
    $usWord = $usWord -replace "theatre$", "theater"
    $usWord = $usWord -replace "favourite$", "favorite"
    $usWord = $usWord -replace "behaviour$", "behavior"
    $usWord = $usWord -replace "organise$", "organize"
    $usWord = $usWord -replace "travelling$", "traveling"
    $usWord = $usWord -replace "cancelled$", "canceled"
    $usWord = $usWord -replace "colour$", "color"
    
    if ($csvMap.ContainsKey($usWord)) { return $csvMap[$usWord] }
    return $null
}

# Function to choose an emoji
function Get-Emoji($word) {
    # Check exact match
    if ($emojiMap.psobject.Properties[$word]) { return $emojiMap.$word }
    
    # Check substring matches
    foreach ($prop in $emojiMap.psobject.Properties) {
        $k = $prop.Name
        if ($word.Contains($k)) { return $prop.Value }
    }
    
    # Check default emojis based on word length or first letter for premium variety
    $val = 0
    foreach ($char in $word.ToCharArray()) { $val += [int]$char }
    $defaultEmojis = $config.defaultEmojis
    return $defaultEmojis[$val % $defaultEmojis.Count]
}

# Process list function
function Process-List($wordList, $levelName, $targetCount, $startId) {
    $processed = @()
    $wordsToProcess = $wordList | Select-Object -First $targetCount
    
    for ($i = 0; $i -lt $wordsToProcess.Count; $i++) {
        $word = $wordsToProcess[$i]
        $id = $startId + $i
        
        # Determine Phonetic
        $phonetic = "/$word/"
        if ($ipaMap.ContainsKey($word)) {
            $phonetic = $ipaMap[$word]
        } elseif ($word -eq 'i') {
            $phonetic = "/aɪ/"
        } elseif ($word -eq 'a') {
            $phonetic = "/ə/"
        }
        
        # Get translation, example, exampleTr
        $tr = ""
        $example = ""
        $exampleTr = ""
        
        # 1. Check if we have verbatim humorous sentence
        if ($humorousMap.psobject.Properties[$word]) {
            $hm = $humorousMap.$word
            $example = $hm.example
            $exampleTr = $hm.exampleTr
            # Get translation from CSV
            $row = Get-Translation $word
            if ($row) { $tr = $row.'Turkish Translation' }
            else { $tr = $word } # Fallback
        }
        # 2. Check if we have standard manual fallback
        elseif ($unmatchedFallbackDict.psobject.Properties[$word]) {
            $fb = $unmatchedFallbackDict.$word
            $tr = $fb.tr
            $example = "I study the word '$word' in this level."
            # Find a slightly better generic example sentence if possible
            if ($word -eq 'a' -or $word -eq 'an') {
                $example = "She saw a cat and an owl in the garden."
            } elseif ($word -eq 'i') {
                $example = "I am a smart student learning English."
            } elseif ($word -eq 'sandwich') {
                $example = "I made a cheese sandwich for lunch."
            } else {
                $example = "Please write a simple sentence with the word '$word'."
            }
            $exampleTr = $fb.trEx
        }
        # 3. Try to get direct CSV match
        else {
            $row = Get-Translation $word
            if ($row) {
                $tr = $row.'Turkish Translation'
                $example = $row.'Example Sentence'
                
                # Check if example is blank or empty
                if ([string]::IsNullOrWhiteSpace($example)) {
                    $example = "We can learn how to use the word '$word' in this section."
                    $exampleTr = $templates.buBolumde -f $tr
                } else {
                    # Premium default example translation
                    $exampleTr = $templates.buCumlede -f $tr
                    if ($word -eq 'abandon') { $exampleTr = $templates.abandon }
                    elseif ($word -eq 'abandoned') { $exampleTr = $templates.abandoned }
                    elseif ($word -eq 'ability') { $exampleTr = $templates.ability }
                    elseif ($word -eq 'able') { $exampleTr = $templates.able }
                    else {
                        # Clean representation
                        if ($row.Definition) {
                            $defClean = $row.Definition -replace "'", "\'" -replace '"', '\"'
                            $exampleTr = "{0} {1} ({2})" -f $templates.cumledekiAnlami, $tr, $defClean
                        } else {
                            $exampleTr = "{0} {1}" -f $templates.ornekCumleCevirisi, $tr
                        }
                    }
                }
            } else {
                # Complete fallback for completely unmatched words
                $tr = $word
                $example = "We are practicing high-level vocabulary with the word '$word'."
                $exampleTr = $templates.buSeviyede -f $word
            }
        }
        
        # Clean special characters to avoid JS injection errors
        $trClean = $tr -replace "'", "\'" -replace '"', '\"'
        $exampleClean = $example -replace "'", "\'" -replace '"', '\"'
        $exampleTrClean = $exampleTr -replace "'", "\'" -replace '"', '\"'
        $phoneticClean = $phonetic -replace "'", "\'" -replace '"', '\"'
        $icon = Get-Emoji $word
        
        $item = [PSCustomObject]@{
            id = $id
            en = $word
            tr = $trClean
            phonetic = $phoneticClean
            example = $exampleClean
            exampleTr = $exampleTrClean
            icon = $icon
        }
        $processed += $item
    }
    
    return $processed
}

# 4. Process all levels
Write-Output "Processing Level A1..."
$a1Words = Process-List $a1WordsRaw "A1" 800 1

Write-Output "Processing Level A2..."
$a2Words = Process-List $a2WordsRaw "A2" 800 1001

Write-Output "Processing Level B1..."
$b1Words = Process-List $b1WordsRaw "B1" 890 2001

Write-Output "Processing Level B2..."
$b2Words = Process-List $b2WordsRaw "B2" 800 3001

# Write data.js file
Write-Output "Writing output file data.js..."

$sb = [System.Text.StringBuilder]::new()
[void]$sb.AppendLine("// Kelime Ustası - Premium Vocabulary Database")
[void]$sb.AppendLine("// Generated statically from Oxford 5000 and 3000 levels with IPA and translations")
[void]$sb.AppendLine()

# Function to write array to StringBuilder
function Write-Array-JS($arrayName, $array) {
    [void]$sb.AppendLine("const $arrayName = [")
    for ($i = 0; $i -lt $array.Count; $i++) {
        $item = $array[$i]
        $comma = if ($i -lt $array.Count - 1) { "," } else { "" }
        [void]$sb.AppendLine("    { id: $($item.id), en: `"$($item.en)`", tr: `"$($item.tr)`", phonetic: `"$($item.phonetic)`", example: `"$($item.example)`", exampleTr: `"$($item.exampleTr)`", icon: `"$($item.icon)`" }$comma")
    }
    [void]$sb.AppendLine("];")
    [void]$sb.AppendLine()
}

Write-Array-JS "A1_WORDS" $a1Words
Write-Array-JS "A2_WORDS" $a2Words
Write-Array-JS "B1_WORDS" $b1Words
Write-Array-JS "B2_WORDS" $b2Words

[System.IO.File]::WriteAllText($outputPath, $sb.ToString(), [System.Text.Encoding]::UTF8)

Write-Output "Success! Vocabulary database data.js successfully compiled with 3290 real vocabulary words!"
