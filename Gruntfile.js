module.exports = function(grunt) {
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		concat: {
			options: {
				separator: '\n\n',
				banner: '/*! <%= pkg.name %> - v<%= pkg.version %> - ' + '<%= grunt.template.today("yyyy-mm-dd") %> */\n\n'
			},
			dist: {
				src: [
					'src/header.js',
					'src/textformatting.js',
					'src/events.js',
					'src/messageHandler.js',
					'src/channelElements.js',
					'src/channels.js',
					'src/help.js',
					'src/options.js',
					'src/socket.js',
					'src/irc.js',
					'src/footer.js'
					],
				dest: '<%= pkg.name %>.js'
			},
		},
		uglify: {
			my_target: {
				files: {
					'<%= pkg.name %>.min.js': ['<%= pkg.name %>.js']
				}
			}
 		 }	
	});
	
	grunt.loadNpmTasks('grunt-bump');
	grunt.loadNpmTasks('grunt-contrib-concat');	
	grunt.loadNpmTasks('grunt-contrib-uglify');
	
	grunt.registerTask('default', ['bump-only','concat','uglify']);
};