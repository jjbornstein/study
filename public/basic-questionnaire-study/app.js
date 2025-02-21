/******************************************************
 * get and parse CSV
 ******************************************************/
 async function getAndParseCSV(filePath) {
	try {
	  const response = await fetch(filePath);
	  if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	  }
  
	  // Read CSV text
	  const csvText = await response.text();
	  csvText.replaceAll("\n", "\r\n");
	  // Split into lines
	  const lines = csvText
		.split("\n")
		.map(line => line.trim()) // No endlines and spaces
		.filter(line => line.length > 0); // if its an actual line
  
	  // Header
	  const headers = lines[0].split(",");
  
	  const data = [];
  
	  // Iterate over all lines except the header
	  for (let i = 1; i < lines.length; i++) {
		//row = participantID - 0, trialId - 1, trialOrder - 2, responseId - 3, percentComplete - 4, answer - 5, correctAnswer - 6
		const row = lines[i].split(",");
		//console.log("Row:", row);
		
		//if (parseFloat(row[4])!=100) {continue;} //only take data from participants that have completed the trials
		if (row[4] == "undefined") continue;
		// CSV columns: participant, correctAnswer, chartType, guess
		let participantID = String(row[0]).substring(32,36);
		const chartType = row[1].split("-")[0];
		const correctAnswer = parseFloat(row[6]);
		const guess = parseFloat(row[5]);
		//console.log(participantID);
		data.push({
		  participantID,
		  correctAnswer,
		  chartType,
		  guess
		});
	  }
	  //console.log(data);
	  return data;
	} catch (error) {
	  console.error("Error parsing CSV:", error);
	  return [];
	}
  }
  
  /******************************************************
   * Analyze data by chart type (using log2( diff + 1/8 ))
   ******************************************************/
   function analyzeDataByChartType(data) {
	// aggregator: { [chartType]: { sumLog, sumDiff, sumDiffSq, count } }
	const results = {};
  
	data.forEach(item => {
	  const { correctAnswer, chartType, guess } = item;
	  const diff = Math.abs(guess - correctAnswer);
	  const logError = Math.log2(diff + 0.125);
  
	  if (!results[chartType]) {
		results[chartType] = {
		  sumLog: 0,
		  sumDiff: 0,
		  sumDiffSq: 0,
		  count: 0
		};
	  }
  
	  results[chartType].sumLog    += logError;
	  results[chartType].sumDiff   += diff;
	  results[chartType].sumDiffSq += diff * diff;
	  results[chartType].count     += 1;
	});
  
	// Convert object into an array of stats
	const stats = [];
	for (const chartType in results) {
	  const { sumLog, sumDiff, sumDiffSq, count } = results[chartType];
  
	  // Average log error
	  const avgLogError = sumLog / count;
  
	  // Raw difference standard deviation
	  const meanDiff = sumDiff / count;          // E[diff]
	  const meanDiffSq = sumDiffSq / count;      // E[diff^2]
	  const variance = meanDiffSq - (meanDiff * meanDiff);
	  const stdevDiff = Math.sqrt(variance);
  
	  stats.push({
		category: chartType,
		averageLogError: avgLogError.toFixed(2),
		stdevDiff: stdevDiff.toFixed(2)
	  });
	}
  
	return stats;
  }
  
  
  /******************************************************
   * Display stats on the page
   ******************************************************/
   function displayStatistics(stats) {
	const container = document.getElementById("stats-container");
	if (!stats || stats.length === 0) {
	  container.textContent = "No data to display or CSV parsing error.";
	  return;
	}
  
	const table = document.createElement("table");
	table.classList.add("stats-table");
  
	// Table header
	const thead = document.createElement("thead");
	const headerRow = document.createElement("tr");
  
	const thCategory = document.createElement("th");
	thCategory.textContent = "Chart Type";
  
	const thAvgLogError = document.createElement("th");
	thAvgLogError.textContent = "Avg. log2 Error";
  
	// New column for standard deviation of raw diff
	const thStdev = document.createElement("th");
	thStdev.textContent = "Std. Dev. (Raw Diff)";
  
	headerRow.appendChild(thCategory);
	headerRow.appendChild(thAvgLogError);
	headerRow.appendChild(thStdev);
	thead.appendChild(headerRow);
	table.appendChild(thead);
  
	// Table body
	const tbody = document.createElement("tbody");
	stats.forEach(item => {
	  const row = document.createElement("tr");
  
	  const tdCategory = document.createElement("td");
	  tdCategory.textContent = item.category;
  
	  const tdAvgLogError = document.createElement("td");
	  tdAvgLogError.textContent = item.averageLogError;
  
	  const tdStdev = document.createElement("td");
	  tdStdev.textContent = item.stdevDiff;
  
	  row.appendChild(tdCategory);
	  row.appendChild(tdAvgLogError);
	  row.appendChild(tdStdev);
	  tbody.appendChild(row);
	});
  
	table.appendChild(tbody);
	container.innerHTML = "";
	container.appendChild(table);
  }
  


/******************************************************
 * Compute a leaderboard for each chart type
 *    - For each participant, compute average log error
 *    - Sort ascending (best to worst)
 ******************************************************/
 function computeLeaderboard(data) {
	// aggregator[chartType][participant] = { sumLog, sumDiff, sumDiffSq, count }
	const aggregator = {};
  
	data.forEach(item => {
	  const { participantID, correctAnswer, chartType, guess } = item;
	  const diff = Math.abs(guess - correctAnswer);
	  const logError = Math.log2(diff + 0.125);
  
	  if (!aggregator[chartType]) {
		aggregator[chartType] = {};
	  }
	  if (!aggregator[chartType][participantID]) {
		aggregator[chartType][participantID] = {
		  sumLog: 0,
		  sumDiff: 0,
		  sumDiffSq: 0,
		  count: 0
		};
	  }
  
	  aggregator[chartType][participantID].sumLog    += logError;
	  aggregator[chartType][participantID].sumDiff   += diff;
	  aggregator[chartType][participantID].sumDiffSq += diff * diff;
	  aggregator[chartType][participantID].count     += 1;
	});
  
	const leaderboard = {};
  
	Object.keys(aggregator).forEach(category => {
	  const participants = aggregator[category];
	  const resultsArray = Object.keys(participants).map(participantID => {
		const { sumLog, sumDiff, sumDiffSq, count } = participants[participantID];
  
		const averageLogError = sumLog / count;
  
		// Raw difference stdev
		const meanDiff = sumDiff / count;
		const meanDiffSq = sumDiffSq / count;
		const variance = meanDiffSq - (meanDiff * meanDiff);
		const stdev = Math.sqrt(variance);
  
		const shortName = participantID.slice(-4);
  
		return {
		  participantID,
		  shortName,
		  averageLogError,
		  stdevDiff: stdev
		};
	  });
  
	  // Sort ascending by average log error
	  resultsArray.sort((a, b) => a.averageLogError - b.averageLogError);
	  leaderboard[category] = resultsArray;
	});
  
	return leaderboard;
  }
  


  /******************************************************
 * Display the leaderboard
 *    - Creates a sub-table for each chart type
 ******************************************************/
   function displayLeaderboard(leaderboard) {
	const container = document.getElementById("leaderboard-container");
	container.innerHTML = "";
  
	for (const category in leaderboard) {
	  const heading = document.createElement("h3");
	  heading.textContent = `Leaderboard for ${category}`;
	  container.appendChild(heading);
  
	  const table = document.createElement("table");
	  table.classList.add("stats-table");
  
	  const thead = document.createElement("thead");
	  const headerRow = document.createElement("tr");
  
	  const thRank = document.createElement("th");
	  thRank.textContent = "Rank";
  
	  const thParticipant = document.createElement("th");
	  thParticipant.textContent = "Last 4 of Participant ID";
  
	  const thAvgError = document.createElement("th");
	  thAvgError.textContent = "Avg. log2 Error";
  
	  // Add new column for raw diff stdev
	  const thStdev = document.createElement("th");
	  thStdev.textContent = "Std. Dev. (Raw Diff)";
  
	  headerRow.appendChild(thRank);
	  headerRow.appendChild(thParticipant);
	  headerRow.appendChild(thAvgError);
	  headerRow.appendChild(thStdev);
	  thead.appendChild(headerRow);
	  table.appendChild(thead);
  
	  const tbody = document.createElement("tbody");
	  leaderboard[category].forEach((item, index) => {
		const row = document.createElement("tr");
  
		const tdRank = document.createElement("td");
		tdRank.textContent = index + 1; // 1-based rank
  
		const tdParticipant = document.createElement("td");
		tdParticipant.textContent = item.shortName;
  
		const tdAvgError = document.createElement("td");
		tdAvgError.textContent = item.averageLogError.toFixed(2);
  
		const tdStdev = document.createElement("td");
		tdStdev.textContent = item.stdevDiff.toFixed(2);
  
		row.appendChild(tdRank);
		row.appendChild(tdParticipant);
		row.appendChild(tdAvgError);
		row.appendChild(tdStdev);
		tbody.appendChild(row);
	  });
  
	  table.appendChild(tbody);
	  container.appendChild(table);
	}
  }
  
  
  /******************************************************
   * Main execution once DOM is loaded
   ******************************************************/
   window.addEventListener("DOMContentLoaded", async () => {
	// 1) Fetch CSV
	const csvData = await getAndParseCSV('data.csv');
	console.log(csvData);
	// 2) If no data, exit
	if (!csvData || csvData.length === 0) {
	  console.error("No valid CSV data found.");
	  return;
	}
  
	// 3) Compute chart-type stats (for the table in #stats-container)
	const stats = analyzeDataByChartType(csvData);
	displayStatistics(stats);
  
	// 4) Compute and display the leaderboard
	const leaderboard = computeLeaderboard(csvData);
	displayLeaderboard(leaderboard);
  });