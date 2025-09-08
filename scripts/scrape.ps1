# Import resources from JSON file
$resources = Get-Content -Raw -Path './data/resources.json' -Encoding utf8 | ConvertFrom-Json

# Set today's date
$currentDate = Get-Date

# Define URL template
$baseUrl = 'https://www.bookup.no/api/public/schedule/{0}/reference/{1}/dateinweek/{2}/part/{3}'

# Build the bookings structure: week -> buildings -> rooms -> bookings
$weekBookings = [PSCustomObject]@{
    weekStart = $currentDate.Date.AddDays(-[int]$currentDate.DayOfWeek)
    weekEnd   = $currentDate.Date.AddDays(6 - [int]$currentDate.DayOfWeek)
    buildings = [System.Collections.Generic.List[object]]::new()
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
        $randomRef = -join ((97..122) | Get-Random -Count 9 | % { [char]$_ })
        
        # Construct the URL
        $url = [string]::Format($baseUrl, $resource.resourceId, $randomRef, $currentDate.ToString('dd.MM.yyyy'), $part.partId)
        
        # Fetch bookings for the room with error handling
        try {
            $response = Invoke-RestMethod -Uri $url

            # Add each event to the room's bookings
            foreach ($event in $response.MonthOrWeek.Events) {
                $room.bookings.Add($event)
            }
        } catch {
            Write-Warning "Failed to fetch bookings for room '$($part.partName)' in building '$($resource.resourceName)': $($_.Exception.Message)"
            # Optionally, you can continue or add a placeholder/error object to $room.bookings
        }

        # Add each event to the room's bookings
        foreach ($event in $response.MonthOrWeek.Events) {
            $room.bookings.Add($event)
        }

        # Add room to building
        $building.rooms.Add($room)
    }

    # Add building to weekBookings
    $weekBookings.buildings.Add($building)
}

# Define file path based on week start date
$weekStartStr = $weekBookings.weekStart.ToString('yyyy-MM-dd')
$savePath = "./data/bookings/$weekStartStr.json"

# Ensure output directory exists
New-Item -ItemType Directory -Force -Path (Split-Path $savePath) | Out-Null

# Save the structured bookings to JSON file
$weekBookings | ConvertTo-Json -Depth 6 | Set-Content $savePath -Encoding utf8