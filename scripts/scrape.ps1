# Import resources from JSON file
$resources = Get-Content -Raw -Path './data/resources.json' -Encoding utf8 | ConvertFrom-Json

# Set today's date
$currentDate = Get-Date

# Number of weeks to fetch (including current week)
$bookingWeeksToFetch = 2

# Initialize list to hold the booking weeks
$bookingWeeks = [System.Collections.Generic.List[object]]::new()

# Populate the booking weeks list with datetimeobjects. 1 object is todays date, the rest are future weeks.
for ($i = 0; $i -lt $bookingWeeksToFetch; $i++) {
    $bookingWeeks.Add($currentDate.AddDays($i * 7))
}

# Define URL template
$baseScheduleUrl = 'https://www.bookup.no/api/public/schedule/{0}/reference/{1}/dateinweek/{2}/part/{3}'
$baseContractUrl = 'https://www.bookup.no/api/public/contract/{0}/reference/{1}/date/{2}'

# Hashtable to track contracts already fetched (to avoid redundant API calls)
$fetchedContracts = [hashtable]::new()

# Iterate over each booking week
foreach ($weekDate in $bookingWeeks) {
    Write-Output "Processing bookings for week starting on: $($weekDate.ToString('dd.MM.yyyy'))"

    # Build the bookings structure: week -> buildings -> rooms -> bookings
    $weekBookings = [PSCustomObject]@{
        lastUpdate = $currentDate.Date
        weekStart  = $weekDate.Date.AddDays( - (([int]$weekDate.DayOfWeek + 6) % 7)) # Ensure week starts on Monday
        weekEnd    = $weekDate.Date.AddDays(6 - (([int]$weekDate.DayOfWeek + 6) % 7)) # Ensure week ends on Sunday
        buildings  = [System.Collections.Generic.List[object]]::new()
    }

    # Iterate over each resource (building)
    foreach ($resource in $resources) {
        # Create building object
        $building = [PSCustomObject]@{
            buildingId   = $resource.resourceId
            buildingName = $resource.resourceName
            rooms        = [System.Collections.Generic.List[object]]::new()
        }

        # Iterate over each part (room) in the building
        foreach ($part in $resource.parts) {
            $room = [PSCustomObject]@{
                roomId   = $part.partId
                roomName = $part.partName
                bookings = [System.Collections.Generic.List[object]]::new()
            }

            # Generate a random reference string
            $randomRef = -join ((97..122) | Get-Random -Count 9 | ForEach-Object { [char]$_ })
        
            # Construct the URL
            $url = [string]::Format($baseScheduleUrl, $resource.resourceId, $randomRef, $weekDate.ToString('dd.MM.yyyy'), $part.partId)
        
            # Fetch bookings for the room with error handling
            try {
                Write-Output "Fetching bookings for room '$($part.partName)' in building '$($resource.resourceName)' from URL: $url"
                $response = Invoke-RestMethod -Uri $url

                # Add each event to the room's bookings
                foreach ($bookingEvent in $response.MonthOrWeek.Events | Where-Object { $_.id }) {
                    # Filter for valid booking events with an ID
                
                    # Fetch contract details if not already fetched
                    if ($fetchedContracts.ContainsKey($bookingEvent.id)) {
                        # If contract details already fetched, reuse them
                    } else {
                        # Fetch contract details for the booking event

                        # Construct the contract URL
                        $baseContractUrlFormatted = [string]::Format($baseContractUrl, $bookingEvent.id, $randomRef, $weekDate.ToString('dd.MM.yyyy'))
                        try {
                            Write-Output "Fetching contract details for booking ID '$($bookingEvent.id)' from URL: $baseContractUrlFormatted"
                            $contractResponse = Invoke-RestMethod -Uri $baseContractUrlFormatted
                            $fetchedContracts[$bookingEvent.id] = $contractResponse
                        } catch {
                            Write-Warning "Failed to fetch contract details for booking ID '$($bookingEvent.id)': $($_.Exception.Message)"
                            $fetchedContracts[$bookingEvent.id] = $null
                        }
                    }
                    # Create a new custom object with booking event and its contract details
                    $bookingRecord = [PSCustomObject]@{
                        start       = $bookingEvent.start
                        end         = $bookingEvent.end
                        id          = $bookingEvent.id
                        color       = $bookingEvent.color
                        borderColor = $bookingEvent.borderColor
                        title       = $fetchedContracts[$bookingEvent.id]?.title
                        renterName  = $fetchedContracts[$bookingEvent.id]?.renterName
                        partNr      = $fetchedContracts[$bookingEvent.id]?.partNr
                        partLabel   = $fetchedContracts[$bookingEvent.id]?.partLabel
                    }
                    $room.bookings.Add($bookingRecord)
                
                }

            } catch {
                Write-Warning "Failed to fetch bookings for room '$($part.partName)' in building '$($resource.resourceName)': $($_.Exception.Message)"
                # Optionally, you can continue or add a placeholder/error object to $room.bookings
            }

            # Add room to building
            $building.rooms.Add($room)
        }

        # Add building to weekBookings
        $weekBookings.buildings.Add($building)
    }

    # Define file path based on week start date
    $year = $weekBookings.weekStart.ToString('yyyy')
    $weekNumber = [System.Globalization.CultureInfo]::InvariantCulture.Calendar.GetWeekOfYear($weekDate, [System.Globalization.CalendarWeekRule]::FirstFourDayWeek, [DayOfWeek]::Monday)
    $fileName = 'week-{0}.json' -f $weekNumber
    $savePath = "./docs/bookings/$year/$fileName"

    # Ensure output directory exists
    New-Item -ItemType Directory -Force -Path (Split-Path $savePath) | Out-Null

    # Save the structured bookings to JSON file
    $weekBookings | ConvertTo-Json -Depth 6 | Set-Content $savePath -Encoding utf8
}